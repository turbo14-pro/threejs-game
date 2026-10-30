/**
 * Physics Worker — runs Rapier physics simulation at 60Hz in a separate thread.
 * Communicates with main thread via postMessage.
 *
 * Input from main thread: { type: 'input', playerId, input, camRot, tick }
 * Output to main thread: { type: 'snapshot', players: [...], serverTick }
 */
import {parentPort, workerData} from "worker_threads";
import RAPIER from "@dimforge/rapier3d-compat";
import {debugLog} from "../src/utils/debugLog.js";

// Initialize Rapier (synchronous in worker)
await RAPIER.init();

// Physics constants
const gravity = {x: 0.0, y: -90.81, z: 0.0};
const world = new RAPIER.World(gravity);
world.timestep = 1 / 30; // 30Hz simulation (matching client/server Rapier timestep)

// Add floor body to prevent players falling through
const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0);
const floorBody = world.createRigidBody(floorBodyDesc);
world.createCollider(RAPIER.ColliderDesc.cuboid(300, 1, 300), floorBody);

// Add lobby platform collider (matches Arena.jsx Platform 1 at y=100)
const lobbyPlatformBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 100, 0);
const lobbyPlatformBody = world.createRigidBody(lobbyPlatformBodyDesc);
world.createCollider(RAPIER.ColliderDesc.cuboid(35, 1, 15), lobbyPlatformBody);

// Shared config (imported from main thread via workerData)
const {PLAYER_BASELINE} = workerData;

// Import shared physics functions
import {
    computeVelocity,
    isGrounded,
    getGroundY,
    getJumpVelocity,
    getAirJumpVelocity,
    getDashSpeed,
    getSlideSpeed,
    getSpeed,
} from "../src/utils/baseGame.js";

// Import power-up effects for jump count adjustment
import {POWERUP_EFFECTS} from "../src/config/playerConfig.js";

// --- PLAYER STATE ---
const players = new Map(); // playerId -> { body, inputBuffer, lastProcessedSequenceId, ... }

// --- OBSTACLE STATE (cereal boxes from server/index.js seed(42)) ---
const obstacles = []; // { x, y, z, w, h, d }

// --- INPUT HANDLING ---
parentPort.on("message", (msg) => {
    switch (msg.type) {
        case "addPlayer": {
            const {playerId} = msg;
            debugLog(`[WORKER] addPlayer: ${playerId}`);
            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, 110, 0)
            .setLinearDamping(0.5)
            .setAdditionalMass(1.0)
            .lockRotations();
            const body = world.createRigidBody(bodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.capsule(1.5, 1).setFriction(0).setRestitution(0);
            world.createCollider(colliderDesc, body);
            players.set(playerId, {
                id: playerId, // FIX: Set id property so snapshot includes it
                body,
                inputBuffer: new Map(),
                lastProcessedSequenceId: -1,
                lastJumpTick: -1,
                prevJump: false,
                prevDashInput: false,
                jumpPhase: "none",
                jumpPhaseTick: 0,
                dashPhase: "none",
                dashPhaseTick: 0,
                camRot: 0,
                skin: "avo",
                anim: {},
                jumpCount: 0, // Track jump count for double jump support
                isBot: false, // Track if this is a bot
                powerUp: null, // { category, rarity } active power-up
            });
            debugLog(`[WORKER] Player added to map: ${playerId}, total players: ${players.size}`);
            break;
        }

        case "addBot": {
            const {playerId} = msg;
            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, 110, 0)
            .setLinearDamping(0.5)
            .setAdditionalMass(1.0)
            .lockRotations();
            const body = world.createRigidBody(bodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.capsule(1.5, 1).setFriction(0).setRestitution(0);
            world.createCollider(colliderDesc, body);
            players.set(playerId, {
                id: playerId, // FIX: Set id property so snapshot includes it
                body,
                inputBuffer: new Map(),
                lastProcessedSequenceId: -1,
                lastJumpTick: -1,
                prevJump: false,
                prevDashInput: false,
                jumpPhase: "none",
                jumpPhaseTick: 0,
                dashPhase: "none",
                dashPhaseTick: 0,
                camRot: 0,
                skin: "avo",
                anim: {},
                jumpCount: 0,
                isBot: true, // Mark as bot
                botTargetId: null, // Target player ID
                botLastDecisionTick: 0, // Last tick we made a decision
                powerUp: null, // { category, rarity } active power-up
            });
            break;
        }

        case "teleport": {
            const {playerId, pos, force} = msg;
            const p = players.get(playerId);
            if (!p) break;
            const body = p.body;
            body.setTranslation({x: pos[0], y: pos[1], z: pos[2]}, true);
            if (force) {
                body.setLinvel({x: 0, y: 0, z: 0}, true);
            }
            break;
        }

        case "removePlayer": {
            const {playerId} = msg;
            const p = players.get(playerId);
            if (p) {
                world.removeRigidBody(p.body);
                players.delete(playerId);
            }
            break;
        }

        case "setObstacles": {
            const {obstacles: obsList} = msg;
            obstacles.length = 0;
            for (const o of obsList) {
                obstacles.push({
                    x: o.x,
                    y: o.y,
                    z: o.z,
                    w: o.w || 30,
                    h: o.h || 36,
                    d: o.d || 12,
                });
                // Create Rapier collider for obstacle so players collide with it
                const halfW = (o.w || 30) / 2;
                const halfH = (o.h || 36) / 2;
                const halfD = (o.d || 12) / 2;
                const boxBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(o.x, o.y, o.z);
                const boxBody = world.createRigidBody(boxBodyDesc);
                world.createCollider(RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD), boxBody);
            }
            break;
        }

        case "setPowerUp": {
            const {playerId, powerUp} = msg;
            const p = players.get(playerId);
            if (p) p.powerUp = powerUp || null;
            break;
        }

        case "input": {
            const {playerId, input, camRot, tick, sequenceId} = msg;
            const p = players.get(playerId);
            if (!p) return;

            // Sequence number validation — reject duplicates and out-of-order inputs
            if (sequenceId !== undefined) {
                if (sequenceId <= p.lastProcessedSequenceId) {
                    return; // Duplicate or out-of-order
                }
                p.lastProcessedSequenceId = sequenceId;
            }

            // Buffer input by client tick
            if (!p.inputBuffer) p.inputBuffer = new Map();
            p.inputBuffer.set(tick, {input, camRot, facingRot: msg.facingRot, skin: msg.skin || p.skin});
            if (p.inputBuffer.size > 120) {
                const oldestTick = Math.min(...p.inputBuffer.keys());
                p.inputBuffer.delete(oldestTick);
            }

            // Update current input (fallback)
            p.input = {input, camRot, facingRot: msg.facingRot, skin: msg.skin || p.skin};
            p.tick = tick;
            p.skin = msg.skin || p.skin;
            p.camRot = camRot || 0;
            p.facingRot = msg.facingRot || 0;
            break;
        }
    }
});

// --- PHYSICS SIMULATION LOOP (30Hz) ---
let serverTick = 0;
const SIMULATION_RATE = 1000 / 30; // 30Hz

function simulate() {
    serverTick++;

    // 1. Process Inputs & Apply Forces
    for (const p of players.values()) {
        // Look up input for the current server tick from buffer
        let bufferedInput = p.inputBuffer ? p.inputBuffer.get(serverTick) : null;
        if (!bufferedInput && p.inputBuffer) {
            let bestTick = -1;
            for (const tick of p.inputBuffer.keys()) {
                if (tick <= serverTick && tick > bestTick) {
                    bestTick = tick;
                }
            }
            if (bestTick >= 0) {
                bufferedInput = p.inputBuffer.get(bestTick);
            }
        }
        const inputData = bufferedInput || p.input;

        if (inputData) {
            const {w, a, s, d, jump, walk, dash, slide} = inputData.input;
            const camRot = inputData.camRot || p.camRot || 0;

            // Calculate target velocity via shared BaseGame
            const speed = getSpeed(walk);
            let {vx, vz} = computeVelocity({w, a, s, d}, camRot, speed);

            const currentVel = p.body.linvel();
            const currentPos = p.body.translation();

            // Ground Check for Server via shared BaseGame (obstacle-aware)
            const playerIsGrounded = isGrounded(currentPos, obstacles);

            // Track jump request from client — persists until server applies impulse
            const jumpPressed = jump && !p.prevJump;
            p.prevJump = jump;
            if (jumpPressed) {
                p.jumpRequested = true;
            } else if (!jump) {
                p.jumpRequested = false;
            } else {
                p.jumpRequested = false;
            }

            // Apply Jump (set velocity matching client's jumpVelocity)
            // Allow double jump while airborne if jumpCount < maxJumps
            // Power-up jump tokens increase maxJumps (bronze=3, silver=4, gold=5, diamond=6)
            const baseMaxJumps = PLAYER_BASELINE.movement.maxJumps || 2;
            let maxJumps = baseMaxJumps;
            if (p.powerUp?.category === "jump" && p.powerUp.rarity) {
                const jumpCountEffect = POWERUP_EFFECTS?.jump?.[p.powerUp.rarity]?.jumpCount;
                if (jumpCountEffect) maxJumps = jumpCountEffect;
            }
            const canJump =
                p.jumpRequested &&
                (!p.lastJumpTick || serverTick - p.lastJumpTick > 10) &&
                (playerIsGrounded || p.jumpCount < maxJumps);

            if (canJump) {
                const jumpVel = playerIsGrounded ? getJumpVelocity() : getAirJumpVelocity();
                p.body.setLinvel({x: currentVel.x, y: jumpVel, z: currentVel.z}, true);
                p.lastJumpTick = serverTick;
                p.jumpRequested = false; // Consume the request
                p.jumpPhase = "launch";
                p.jumpPhaseTick = serverTick;
                // Update anim state for remote players
                p.anim = {...p.anim, jp: "launch"};
                // Set currentVel.y to jumpVelocity so setLinvel below preserves it
                currentVel.y = getJumpVelocity();
                // Increment jump count (grounded jump resets to 1, air jump increments)
                if (playerIsGrounded) {
                    p.jumpCount = 1;
                } else {
                    p.jumpCount++;
                }
                debugLog(`[SERVER JUMP APPLY] player=${p.id} newVelY=${currentVel.y} jumpCount=${p.jumpCount}`);
            } else if (p.jumpRequested && !playerIsGrounded && p.jumpCount >= maxJumps) {
                debugLog(
                    `[SERVER JUMP] player=${p.id} jumpRequested=true but max jumps reached (${p.jumpCount}/${maxJumps})`
                );
            } else if (p.jumpRequested && !playerIsGrounded) {
                debugLog(`[SERVER JUMP] player=${p.id} jumpRequested=true but NOT grounded, skipping`);
            } else if (p.jumpRequested && p.lastJumpTick && serverTick - p.lastJumpTick <= 10) {
                debugLog(
                    `[SERVER JUMP] player=${p.id} jumpRequested=true but cooldown active (${
                        serverTick - p.lastJumpTick
                    } ticks since last)`
                );
            }

            // Reset jump count when grounded
            if (playerIsGrounded && p.jumpPhase === "none") {
                p.jumpCount = 0;
            }

            // Track jump phase for remote animation sync
            const JUMP_LAUNCH_TICKS = 2;
            const JUMP_LAND_TICKS = 2;

            if (p.jumpPhase === "launch") {
                if (serverTick - p.jumpPhaseTick >= JUMP_LAUNCH_TICKS) {
                    if (!playerIsGrounded) {
                        p.jumpPhase = "air";
                        p.jumpPhaseTick = serverTick;
                        p.anim = {...p.anim, jp: "air"};
                    }
                }
            } else if (p.jumpPhase === "air" && playerIsGrounded) {
                p.jumpPhase = "land";
                p.jumpPhaseTick = serverTick;
                p.anim = {...p.anim, jp: "land"};
            } else if (p.jumpPhase === "land") {
                if (serverTick - p.jumpPhaseTick >= JUMP_LAND_TICKS) {
                    p.jumpPhase = "none";
                    p.anim = {...p.anim, jp: "none"};
                }
            }

            // Dash
            const dashPressed = dash && !p.prevDashInput;
            p.prevDashInput = dash;

            if (dashPressed && playerIsGrounded && (!p.lastDashTick || serverTick - p.lastDashTick > 20)) {
                const dashSpeed = getDashSpeed();
                const rot = camRot;
                // Match computeVelocity sign convention: vx = -sin(rot), vz = -cos(rot) for forward
                const dashVx = -Math.sin(rot) * dashSpeed;
                const dashVz = -Math.cos(rot) * dashSpeed;
                const currentVel2 = p.body.linvel();
                p.body.setLinvel({x: dashVx, y: currentVel2.y, z: dashVz}, true);
                p.lastDashTick = serverTick;
                p.dashPhase = "dash";
                p.dashPhaseTick = serverTick;
                p.anim = {...p.anim, jp: "dash"};
            }

            if (p.dashPhase === "dash" && serverTick - p.dashPhaseTick >= 2) {
                p.dashPhase = "none";
                p.anim = {...p.anim, jp: "none"};
            }

            // Apply Slide
            if (slide && playerIsGrounded) {
                const slideSpeed = getSlideSpeed();
                const rot = camRot;
                // Match computeVelocity sign convention: vx = -sin(rot), vz = -cos(rot) for forward
                const slideVx = -Math.sin(rot) * slideSpeed;
                const slideVz = -Math.cos(rot) * slideSpeed;
                vx = slideVx;
                vz = slideVz;
                p.anim = {...p.anim, sl: true};
            } else if (!slide) {
                if (p.anim?.sl) {
                    p.anim = {...p.anim, sl: false};
                }
            }

            p.body.setLinvel({x: vx, y: currentVel.y, z: vz}, true);
        }
    }

    // 2. Step Physics
    world.step();

    // 3. Build snapshot — ALWAYS broadcast all players (heartbeat) so clients
    // never run out of snapshot data and freeze
    const playerList = [];
    for (const p of players.values()) {
        const pos = p.body.translation();
        const vel = p.body.linvel();
        const rot = p.facingRot || p.camRot || 0; // Use client character facing for remote display
        const groundY = getGroundY(pos, obstacles);

        playerList.push({
            id: p.id,
            pos: [
                Number.isFinite(pos.x) ? pos.x : 0,
                Number.isFinite(pos.y) ? pos.y : 0,
                Number.isFinite(pos.z) ? pos.z : 0,
            ],
            vel: [
                Number.isFinite(vel.x) ? vel.x : 0,
                Number.isFinite(vel.y) ? vel.y : 0,
                Number.isFinite(vel.z) ? vel.z : 0,
            ],
            rot: Number.isFinite(rot) ? rot : 0,
            skin: p.skin,
            anim: p.anim,
            tick: p.tick,
            lastProcessedSeq: p.lastProcessedSequenceId,
            groundY: Number.isFinite(groundY) ? groundY : -1,
        });
    }

    // Send snapshot to main thread at 30Hz (every tick)
    // X, Y, Z all update together — no decoupled Y throttle
    parentPort.postMessage({type: "snapshot", players: playerList, obstacles, serverTick});
    debugLog(`[WORKER] Snapshot sent: ${playerList.length} players, tick=${serverTick}`);
}

// Start simulation loop
globalThis.setInterval(simulate, SIMULATION_RATE);
