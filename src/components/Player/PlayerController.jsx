import React, {useRef, useState, useEffect, useCallback} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import {useKeyboardControls} from "@react-three/drei";
import {RigidBody, CapsuleCollider, useRapier} from "@react-three/rapier";
import * as THREE from "three";
import PlayerModel, {ContactShadow} from "./PlayerModel.jsx";
import {useGameStore} from "../../store/useGameStore";
import {
    PLAYER_BASELINE,
    canUseDash,
    getDashConfig,
    getMaxJumps,
    getPowerUpEffect,
    getActionIntensity,
    shouldEndDash,
} from "../../config/playerConfig";
import {setLocalPlayerWorldPos, setLocalPlayerWorldVel} from "../World/items/PowerUpCoin.jsx";
import {damageBot, applyBotKnockback, getBotVelocity} from "./botRegistry.js";
import {BOT_COMBAT, resolveImpact} from "./BotAI.jsx";
import {soundManager, computeHitVolume} from "../../utils/SoundManager";
import {audioFlag} from "../../utils/audioDebugFlags";
import {useGamepad} from "../../hooks/useGamepad.js";
// The debug helpers are also published on globalThis by utils/debugLog.js, but
// relying on that global makes the module fail to load (ReferenceError) if the
// logger is ever tree-shaken or the import order changes. Import them directly.
import {debugLog, debugWarn, debugError} from "../../utils/debugLog";

const direction = new THREE.Vector3();
const frontVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const camPos = new THREE.Vector3();
// P1-#12: shared scratch objects for the per-frame hot path. These used to be
// allocated with `new THREE.Vector3()` / `new THREE.Quaternion()` inside
// useFrame, which churns the GC every frame (60+/s) and can hitch the game.
const upAxis = new THREE.Vector3(0, 1, 0);
const rightAxis = new THREE.Vector3(1, 0, 0);
const scratchMeshForward = new THREE.Vector3();
const scratchCamForward = new THREE.Vector3();
const scratchQuat = new THREE.Quaternion();
const scratchCamOffset = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();
const scratchLookDir = new THREE.Vector3();
const scratchLookTarget = new THREE.Vector3();

// P0-#3: states where the physics simulation must not advance. MENU keeps the
// old "attract mode" fall-through; PAUSED now freezes movement/physics/net.
const SIM_RUNNING_STATES = new Set(["PLAYING", "BATTLE", "DROP", "PREMATCH", "LOBBY"]);

// --- FOOTSTEP PLAYBACK RATE ---
// Maps horizontal velocity to a playback rate for movement loops.
// rate = hSpeed / referenceSpeed, so normal speed = 1.0 and a speed power-up
// that doubles velocity makes footsteps play 2x faster (higher pitch).
// Clamped to [0.5, 2.0] to avoid unnatural pitch shifts.
function footstepRate(hSpeed, referenceSpeed) {
    const r = referenceSpeed > 0 ? hSpeed / referenceSpeed : 1.0;
    return Math.max(0.5, Math.min(2.0, r));
}

// P1-#9: teleport targets must be finite + inside the world.
const TELEPORT_BOUNDS = {x: 290, yMin: -50, yMax: 400, z: 290};
function sanitizeTeleportTarget(t) {
    if (!t) return null;
    const x = Number(t.x),
        y = Number(t.y),
        z = Number(t.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return {
        x: Math.max(-TELEPORT_BOUNDS.x, Math.min(TELEPORT_BOUNDS.x, x)),
        y: Math.max(TELEPORT_BOUNDS.yMin, Math.min(TELEPORT_BOUNDS.yMax, y)),
        z: Math.max(-TELEPORT_BOUNDS.z, Math.min(TELEPORT_BOUNDS.z, z)),
    };
}

// P1-#11: sanitize a live Rapier translation proxy into plain numbers.
function snapTranslation(t) {
    try {
        if (!t) return null;
        const x = Number(t.x),
            y = Number(t.y),
            z = Number(t.z);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
        return {x, y, z};
    } catch {
        return null;
    }
}

export default function PlayerController({sendUpdate}) {
    const rigidBodyRef = useRef();
    const playerGroupRef = useRef();
    const {camera, gl} = useThree();
    const {world, rapier} = useRapier();
    const [, getKeys] = useKeyboardControls();
    const gameState = useGameStore((state) => state.game.state);
    const mobileInput = useGameStore((state) => state.mobileInput);
    const {poll} = useGamepad();
    const matchPhase = useGameStore((state) => state.game.phase);
    const countdown = useGameStore((state) => state.game.countdown);
    const playerHealth = useGameStore((state) => state.player.health);
    const healPlayer = useGameStore((state) => state.healPlayer);
    const selectedSkin = useGameStore((state) => state.player.selectedSkin);
    const triggerRipple = useGameStore((state) => state.triggerRipple);
    const addShockwave = useGameStore((state) => state.addShockwave);
    const triggerSlideImpact = useGameStore((state) => state.triggerSlideImpact);
    const knockbackCount = useGameStore((state) => state.knockbackCount);
    const knockbackDir = useGameStore((state) => state.knockbackDir);
    const knockbackForce = useGameStore((state) => state.knockbackForce);
    const powerUp = useGameStore((state) => state.powerUp);

    // --- PLAYER STATE ---
    const [isSliding, setIsSliding] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [isWalking, setIsWalking] = useState(false);
    const [moveDir, setMoveDir] = useState("for");
    const [jumpPhase, setJumpPhase] = useState("none"); // none, launch, air, land
    const [jumpTransitionId, setJumpTransitionId] = useState(0);
    const animConfig = useGameStore((state) => state.player.playerAnimations);
    const setPlayerAnimations = useGameStore((state) => state.setPlayerAnimations);
    const targetRotationY = useRef(Math.PI);
    const [jumpCount, setJumpCount] = useState(0);
    const isDashing = useRef(false);
    const [isDashingVisual, setIsDashingVisual] = useState(false);
    const dashCooldown = useRef(0);
    const prevDashInput = useRef(false);
    const dashDir = useRef(new THREE.Vector3());
    const dashStartPos = useRef(new THREE.Vector3());
    const netTick = useRef(0);
    const physicsAccumulator = useRef(0); // Gates velocity application at 30Hz to match server
    const netAccumulator = useRef(0);
    const inputHistory = useRef([]); // [{ tick, pos, input, camRot }]
    const sentInputs = useRef(new Map()); // sequenceId -> { tick, pos, input, camRot }

    // --- RECONCILIATION LISTENER ---
    useEffect(() => {
        const unsubscribe = useGameStore.subscribe(
            (state) => state.lastServerState,
            (serverState) => {
                if (!serverState || !rigidBodyRef.current) return;

                // Find the history entry for this tick
                const historyEntry = inputHistory.current.find((e) => e.tick === serverState.tick);
                if (!historyEntry) return;

                const {pos: sPos, vel: sVel} = serverState;

                // Guard against NaN/Infinity in server state to prevent corrupting
                // the physics body and crashing PositionalAudio panners (non-finite
                // AudioParam values in updateMatrixWorld).
                const posValid = sPos && sPos.length === 3 && sPos.every((v) => Number.isFinite(v));
                const velValid = sVel && sVel.length === 3 && sVel.every((v) => Number.isFinite(v));

                if (!posValid) {
                    debugWarn(
                        `[Reconciliation] Ignoring non-finite server position at tick ${serverState.tick}:`,
                        sPos
                    );
                    return;
                }

                const pos = historyEntry.pos;
                const diff = Math.sqrt(Math.pow(pos.x - sPos[0], 2) + Math.pow(pos.z - sPos[2], 2));

                // Increase threshold to 0.3m to account for 30Hz server + network jitter + physics divergence
                // 0.15m was too tight for 33ms tick interval + variable client frame rate
                if (diff > 0.3) {
                    debugLog(
                        "multiplayer",
                        `Desync detected at tick ${serverState.tick}! Diff: ${diff.toFixed(2)}m. Snapping...`
                    );

                    // Increment desync counter for LatencyGraph
                    useGameStore.getState().incrementDesyncCount();

                    // Authoritative Snap — fully submit to server state
                    // Set both position AND velocity so the next physics calculation
                    // starts from the server's authoritative state, not a client-predicted one.
                    rigidBodyRef.current.setTranslation(
                        {
                            x: sPos[0],
                            y: sPos[1],
                            z: sPos[2],
                        },
                        true
                    );

                    if (velValid) {
                        rigidBodyRef.current.setLinvel({x: sVel[0], y: sVel[1], z: sVel[2]}, true);
                    }

                    // RE-APPLY UNACKNOWLEDGED INPUTS (client-side prediction)
                    // After snapping to server state, re-simulate only inputs the server
                    // hasn't processed yet. These are applied on top of the server's
                    // authoritative state so the client catches up without overriding
                    // the server's position/velocity calculation.
                    const unacknowledged = Array.from(sentInputs.current.entries())
                    .filter(([, entry]) => entry.tick > serverState.tick)
                    .sort((a, b) => a[1].tick - b[1].tick)
                    .map(([, entry]) => entry);

                    unacknowledged.forEach((entry) => {
                        const {input, camRot} = entry;
                        const {w, a, s, d, walk} = input;

                        const moveX = (d ? 1 : 0) - (a ? 1 : 0);
                        const moveZ = (s ? 1 : 0) - (w ? 1 : 0);

                        if (moveX !== 0 || moveZ !== 0) {
                            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
                            const nx = moveX / length;
                            const nz = moveZ / length;
                            const rot = camRot || 0;
                            const speed = walk
                                ? PLAYER_BASELINE.movement.walkSpeed
                                : PLAYER_BASELINE.movement.sprintSpeed;
                            const vx = (nx * Math.cos(rot) + nz * Math.sin(rot)) * speed;
                            const vz = (-nx * Math.sin(rot) + nz * Math.cos(rot)) * speed;

                            // Apply input velocity on top of server velocity, preserving Y
                            const currentVel = rigidBodyRef.current.linvel();
                            rigidBodyRef.current.setLinvel({x: vx, y: currentVel.y, z: vz}, true);
                        }
                    });

                    // Remove the extra damping step — the server's Rapier simulation
                    // already applies damping. Applying it again on the client causes
                    // desync between client and server velocity calculations.
                }

                // Also reconcile velocity drift (prevents gradual yank)
                if (velValid && rigidBodyRef.current) {
                    const clientVel = rigidBodyRef.current.linvel();
                    const velDiff = Math.sqrt(Math.pow(clientVel.x - sVel[0], 2) + Math.pow(clientVel.z - sVel[2], 2));
                    if (velDiff > 5) {
                        // Significant velocity mismatch
                        debugLog("multiplayer", `Velocity drift: ${velDiff.toFixed(2)}. Correcting...`);
                        rigidBodyRef.current.setLinvel({x: sVel[0], y: sVel[1], z: sVel[2]}, true);
                    }
                }

                // Cleanup old history
                inputHistory.current = inputHistory.current.filter((e) => e.tick > serverState.tick);

                // Cleanup acknowledged sentInputs — remove entries whose sequenceId the
                // server has confirmed via lastProcessedSeq (Phase 04).
                const lastSeq = serverState.lastProcessedSeq;
                if (lastSeq !== undefined) {
                    for (const [seqId] of sentInputs.current.entries()) {
                        if (seqId <= lastSeq) {
                            sentInputs.current.delete(seqId);
                        }
                    }
                }
            }
        );
        return unsubscribe;
    }, []);

    // --- REFS / TIMERS ---
    const slideTimer = useRef(0);
    const slideSoundRef = useRef(null); // Reference to fade slide sound
    // P1-#9: caps how many frames a teleport may keep re-applying (see useFrame).
    const teleportRetries = useRef(0);
    const lastDamageTime = useRef(0);
    const jumpTimer = useRef(0);
    const physicsJumpTriggered = useRef(false);
    const jumpLock = useRef({sprint: false, dir: "for"});
    const prevJumpingInput = useRef(false);
    const externalForce = useRef(new THREE.Vector3());
    const worldVelocityRef = useRef(new THREE.Vector3());
    const hSpeedRef = useRef(0); // Horizontal velocity, synced from useFrame for animation speed
    const currentlyGroundedRef = useRef(false); // Synced from useFrame for footstep callback
    const currentPhaseRef = useRef("none"); // Synced from useFrame for footstep callback
    const actualWalkingRef = useRef(false); // Synced from useFrame for footstep callback

    // P0-#4: unmount cleanup — stop loop sounds + detach them OUTSIDE the render
    // traversal (direct parent.remove() here is safe: we are in a React effect
    // cleanup, not inside three's updateMatrixWorld loop). Without this, a
    // remount (death/restart/StrictMode) leaves the old PositionalAudio nodes
    // attached to a dead parent chain — and every render then walks a corrupt
    // graph (the updateMatrixWorld crash) or linearRamps a NaN position.
    const stopLoopSound = useCallback((ref) => {
        const s = ref?.current;
        if (!s) return;
        ref.current = null;
        // Use the SoundManager release path: it stops playback, untracks the node
        // from `instances` and DEFERS the scene-graph detach (microtask) so we
        // never splice a parent's children array mid-traversal. Calling
        // parent.remove() inline from a useFrame collision handler is exactly what
        // caused "Cannot read properties of undefined (reading 'updateMatrixWorld')".
        try {
            soundManager?.release?.(s);
        } catch {
            /* fall through to manual cleanup */
        }
    }, []);
    useEffect(
        () => () => {
            stopLoopSound(slideSoundRef);
            stopLoopSound(dashSoundRef);
        },
        [stopLoopSound]
    );
    const preImpactVelocity = useRef(new THREE.Vector3());
    const isSlidingRef = useRef(false); // Mirror isSliding state for collision handler (avoids stale closure)
    const slideFadeRef = useRef(false); // True while slide sound is fading out
    const slideCooldown = useRef(0); // Seconds remaining before another slide can start
    const intendedSlideDuration = useRef(0.6); // The slide duration set at slide start
    const dashSoundRef = useRef(null); // Reference to fade dash sound
    const dashFadeRef = useRef(false); // True while dash sound is fading out

    // Baseline movement speeds (from PLAYER_BASELINE) — used by the footstep callback
    // which lives outside useFrame and needs stable references.
    const WALK_SPEED = PLAYER_BASELINE.movement.walkSpeed; // 4 m/s
    const SPRINT_SPEED = PLAYER_BASELINE.movement.sprintSpeed; // 35 m/s

    // 2-STEP ONE-SHOT FOOTSTEPS
    // Triggered by PlayerModel's animation loop event (once per 2-step cycle).
    // Two footsteps fire per loop (left + right) to match the 2-step animation.
    // Each footstep is a one-shot positional sound with velocity-based playback rate
    // so speed power-ups make footsteps play faster. Random detune on one-shots
    // provides variety without breaking velocity sync (detune is skipped on loops).
    // Uses refs synced from useFrame so the callback is stable and doesn't
    // recreate every frame.
    const playFootstep = useCallback(
        (_foot) => {
            if (!audioFlag("movementLoops")) return;
            if (!currentlyGroundedRef.current || currentPhaseRef.current !== "none") return;
            if (!playerGroupRef.current) return;

            const volume = actualWalkingRef.current ? 0.6 : 0.8;
            const rate = actualWalkingRef.current
                ? footstepRate(hSpeedRef.current, WALK_SPEED)
                : footstepRate(hSpeedRef.current, SPRINT_SPEED);

            const stepSound = soundManager.playPositional("step", playerGroupRef.current, volume, 5, 1.0, 50, false);
            if (stepSound) {
                soundManager.setPlaybackRate(stepSound, rate);
            }
        },
        [audioFlag, playerGroupRef.current]
    );

    // Load animation configuration dynamically
    useEffect(() => {
        if (animConfig) return; // Already loaded!
        fetch("skins/animations.json")
        .then((res) => res.json())
        .then((d) => setPlayerAnimations(d.Melee))
        .catch((err) => debugError("PlayerController failed to load animations.json", err));
    }, [animConfig, setPlayerAnimations]); // Lock animation states during jump phase

    // Camera & Zoom State
    const rotationY = useRef(Math.PI);
    const rotationX = useRef(0);
    const zoomDistance = useRef(12); // Default zoom

    // Smoothed camera state to prevent clipping via lerp corners
    const smoothRotY = useRef(Math.PI);
    const smoothRotX = useRef(0);
    const smoothZoom = useRef(12);

    const lastPinchDist = useRef(0);

    // Touch zoom management
    const DEFAULT_ZOOM = 12;
    const intendedZoom = useRef(12); // What the user actually wants (pre-collision)
    const lastPinchTime = useRef(0); // Timestamp of last pinch/scroll for auto-return
    const isTouchDevice = useRef("ontouchstart" in window || navigator.maxTouchPoints > 0);

    useEffect(() => {
        if (gameState !== "PLAYING") return;

        const onMouseMove = (e) => {
            if (document.pointerLockElement) {
                rotationY.current -= e.movementX * 0.002;
                rotationX.current -= e.movementY * 0.002;
                rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));
            }
        };

        const onWheel = (e) => {
            zoomDistance.current = Math.max(2, Math.min(25, zoomDistance.current + e.deltaY * 0.01));
            intendedZoom.current = zoomDistance.current;
            lastPinchTime.current = Date.now();
        };

        // Pinch-to-zoom only (camera joystick handles rotation via store)
        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                lastPinchDist.current = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                lastPinchTime.current = Date.now();
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (lastPinchDist.current - dist) * 0.05;
                zoomDistance.current = Math.max(2, Math.min(25, zoomDistance.current + delta));
                intendedZoom.current = zoomDistance.current;
                lastPinchDist.current = dist;
                lastPinchTime.current = Date.now();
            }
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("wheel", onWheel);
        window.addEventListener("touchstart", onTouchStart);
        window.addEventListener("touchmove", onTouchMove);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
        };
    }, [gameState]);

    // Teleport: compute target in the subscriber, apply in useFrame (outside physics step)
    const pendingTeleport = useRef(null); // { x, y, z } or null
    const pendingRespawn = useRef(false); // true → move to lobby next frame

    useEffect(() => {
        const unsubscribe = useGameStore.subscribe(
            (state) => state.teleportCount,
            (count) => {
                if (count > 0) {
                    if (soundManager && soundManager.listener)
                        soundManager.playPositional("teleport", playerGroupRef.current, 1, 10, 1.0, 50, false);

                    // Use custom spawn target if set by spawnPlayerAtRandomLocation, otherwise generate random
                    let tx, tz, ty;
                    const target = useGameStore.getState().pendingTeleportTarget;
                    if (target) {
                        tx = target.x;
                        tz = target.z;
                        ty = target.y;
                        // DON'T clear here — useFrame needs it; clear only after confirm
                    } else {
                        // Replicate cereal box positions (must match Arena.jsx seededRandom(42))
                        const seededRandom = (seed) => {
                            let s = seed;
                            return () => {
                                s = (s * 9301 + 49297) % 233280;
                                return s / 233280;
                            };
                        };
                        const rand = seededRandom(42);
                        const cerealPositions = [];
                        for (let i = 0; i < 20; i++) {
                            let bx,
                                bz,
                                valid = false,
                                attempts = 0;
                            while (!valid && attempts < 100) {
                                bx = (rand() - 0.5) * 520;
                                bz = (rand() - 0.5) * 520;
                                attempts++;
                                if (Math.abs(bx) < 45 && bz > -75 && bz < 30) continue;
                                let ok = true;
                                for (const b of cerealPositions) {
                                    if (Math.hypot(bx - b.x, bz - b.z) < 42) {
                                        ok = false;
                                        break;
                                    }
                                }
                                if (ok) valid = true;
                            }
                            if (valid) cerealPositions.push({x: bx, z: bz});
                        }

                        const TABLE_HALF = 280;
                        const PLATFORM_ZONES = [
                            {cx: 0, cz: 0, rx: 50, rz: 35},
                            {cx: 0, cz: -45, rx: 40, rz: 20},
                            {cx: 0, cz: -22.5, rx: 12, rz: 15},
                        ];
                        const SAFE_DIST = 22;

                        let placed = false;
                        for (let attempt = 0; attempt < 200; attempt++) {
                            tx = (Math.random() - 0.5) * TABLE_HALF * 2;
                            tz = (Math.random() - 0.5) * TABLE_HALF * 2;
                            let inZone = false;
                            for (const z of PLATFORM_ZONES) {
                                if (Math.abs(tx - z.cx) < z.rx && Math.abs(tz - z.cz) < z.rz) {
                                    inZone = true;
                                    break;
                                }
                            }
                            if (inZone) continue;
                            let tooClose = false;
                            for (const b of cerealPositions) {
                                if (Math.hypot(tx - b.x, tz - b.z) < SAFE_DIST) {
                                    tooClose = true;
                                    break;
                                }
                            }
                            if (tooClose) continue;
                            placed = true;
                            break;
                        }
                        if (!placed) {
                            tx = 0;
                            tz = 80;
                        }
                        ty = 15; // 15m above arena floor
                    }

                    // Store target — useFrame will apply it outside the physics step
                    pendingTeleport.current = {x: tx, y: ty, z: tz};

                    // Lock pointer and set game state to playing
                    try {
                        gl.domElement.requestPointerLock();
                    } catch {
                        debugWarn("Pointer lock request failed (needs user gesture)");
                    }
                    useGameStore.getState().setGameState("PLAYING");
                }
            }
        );
        return unsubscribe;
    }, [gl]);

    // Respawn handler (teleport back to platform 1)
    useEffect(() => {
        const unsubscribe = useGameStore.subscribe(
            (state) => state.respawnCount,
            (count) => {
                if (count > 0 && rigidBodyRef.current) {
                    pendingRespawn.current = true;
                }
            }
        );
        return unsubscribe;
    }, [gl]);

    // --- SKIN SYNC ---
    // Sends our skin to the server on connect AND whenever it changes.
    // This ensures the server knows our skin from the start.
    useEffect(() => {
        if (sendUpdate && selectedSkin) {
            sendUpdate({skin: selectedSkin});
        }
    }, [selectedSkin, sendUpdate]);

    // Also send skin immediately on mount (in case it's the default and hasn't "changed")
    useEffect(() => {
        if (sendUpdate && selectedSkin) {
            sendUpdate({skin: selectedSkin});
        }
    }, [sendUpdate]); // Only run once on mount

    // Knockback effect listener
    useEffect(() => {
        if (knockbackCount > 0 && rigidBodyRef.current) {
            const setIsStunned = useGameStore.getState().setIsStunned;
            setIsStunned(true);

            const forceMultiplier = knockbackForce;
            const normalizedForce = Math.min(1, forceMultiplier / 250);
            // 1. Horizontal push
            externalForce.current.set(knockbackDir.x * forceMultiplier, 0, knockbackDir.z * forceMultiplier);

            // 2. Vertical pop — scaled proportionally to the knockback force
            const currentVel = rigidBodyRef.current.linvel();
            rigidBodyRef.current.setLinvel(
                {
                    x: currentVel.x,
                    y: 55 * normalizedForce,
                    z: currentVel.z,
                },
                true
            );

            soundManager.playPositional("hit", playerGroupRef.current, 1, 5, 1.0, 50, false);

            // Yield control for 1.2s to allow the flight to finish
            setTimeout(() => setIsStunned(false), 1200);
        }
    }, [knockbackCount]);

    //logs useFrame time to console
    //console.time("useFrame");
    useFrame((state, delta) => {
        if (gameState !== "PLAYING" || !rigidBodyRef.current || !playerGroupRef.current) {
            // Publish the player's world position even when the match isn't live. Power-up
            // pickup is distance-based against this value, so if it stays stale while the
            // menu camera orbits, coins spawned before START can never be collected.
            if (rigidBodyRef.current) {
                const t = rigidBodyRef.current.translation();
                if (Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z)) {
                    setLocalPlayerWorldPos(t);
                    useGameStore.getState().setPlayerPosition(t);
                }
            }
            return;
        }

        const keys = getKeys();
        const gp = poll ? poll(0.016) : null;
        // Button 9 = pause / resume (like ESC) — decaptures mouse, loads pause menu, disables movement
        if (gp && gp.buttons[9] && gp.buttons[9].pressed && gp.edges && gp.edges[9]) {
            const current = useGameStore.getState().game.state;
            if (current === "MENU") {
                // Resume: close menu, restore sound, lock pointer
                useGameStore.getState().setGameState("PLAYING");
                useGameStore.getState().setMasterVolume(1.0);
                try {
                    gl.domElement.requestPointerLock();
                } catch {}
            } else {
                // Pause: open menu, mute sound, exit pointer lock
                useGameStore.getState().setGameState("MENU");
                useGameStore.getState().setMasterVolume(0.0);
                if (document.pointerLockElement) document.exitPointerLock();
            }
        }
        // Gamepad right stick look (retains mouse)
        if (gp && (Math.abs(gp.axes.rx) > 0.15 || gp.axes.rtPressed || Math.abs(gp.axes.rt) > 0.15)) {
            rotationX.current -= gp.axes.rx * 0.05; // up/down
            rotationY.current -= (gp.axes.rt || 0) * 0.05; // left/right via rt
            rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));
        }
        if (gp) {
            const active =
                Math.abs(gp.axes.lx) > 0.15 ||
                Math.abs(gp.axes.ly) > 0.15 ||
                Math.abs(gp.axes.rx) > 0.15 ||
                Math.abs(gp.axes.ry) > 0.15 ||
                Math.abs(gp.axes.rt) > 0.15 ||
                gp.axes.rtPressed ||
                gp.edges.length > 0 ||
                gp.buttons.some((b) => b.pressed);
            if (active)
                debugLog(
                    "gamepad",
                    "axes:",
                    {
                        lx: gp.axes.lx.toFixed(2),
                        ly: gp.axes.ly.toFixed(2),
                        rx: gp.axes.rx.toFixed(2),
                        ry: gp.axes.ry.toFixed(2),
                        rt: gp.axes.rt.toFixed(2),
                        rtPressed: gp.axes.rtPressed,
                    },
                    "edges:",
                    gp.edges,
                    "buttons:",
                    gp.buttons.map((b, i) => (b.pressed ? i : null)).filter((x) => x !== null)
                );
        }
        // P1-#11: snapshot the translation ONCE into plain numbers. Reading the
        // live Rapier proxy repeatedly (and re-reading it inside callbacks) risks
        // touching the WASM object while the solver holds it -> "recursive use of
        // an object detected which is already in use" / unsafe aliasing.
        const translation = snapTranslation(rigidBodyRef.current.translation());

        // SAFETY: If physics returns NaN, hard-reset to the lobby instead of
        // returning early. Returning early leaves the corrupt NaN body in the world:
        // attached PositionalAudio nodes keep a NaN world matrix and three throws
        // "linearRampToValueAtTime non-finite" on EVERY render, forever.
        if (!translation) {
            try {
                rigidBodyRef.current.setTranslation({x: 0, y: 103, z: 0}, true);
                rigidBodyRef.current.setLinvel({x: 0, y: 0, z: 0}, true);
                rigidBodyRef.current.setAngvel({x: 0, y: 0, z: 0}, true);
                worldVelocityRef.current.set(0, 0, 0);
                setLocalPlayerWorldPos({x: 0, y: 103, z: 0});
                useGameStore.getState().setPlayerPosition({x: 0, y: 103, z: 0});
            } catch {}
            return;
        }

        // Update shared player position for power-up distance pickup — but NEVER
        // publish a NaN/Infinity translation. One corrupt broadcast poisons
        // getLocalPlayerWorldPos() consumers (bots chase NaN -> their kinematic
        // bodies go NaN -> their meshes + attached PositionalAudios go NaN ->
        // panner.linearRampToValueAtTime throws every frame, forever).
        setLocalPlayerWorldPos(translation);
        // Share the same snapshot with the store so the sun rig can follow the player
        useGameStore.getState().setPlayerPosition(translation);
        // Publish horizontal velocity so CPU bots can run a Newtonian impact resolution
        // (who's driving into whom) instead of blindly knocking back whatever they touch.
        if (Number.isFinite(worldVelocityRef.current?.x) && Number.isFinite(worldVelocityRef.current?.z)) {
            setLocalPlayerWorldVel(worldVelocityRef.current);
        }
        // Only update debug ripple position when debug mode is active
        if (useGameStore.getState().debugRipple.enabled) {
            useGameStore.getState().setRippleDebugPosition({x: translation.x, y: translation.y, z: translation.z});
        }

        // Apply pending teleport OUTSIDE the physics step (setTranslation during step is ignored)
        // P1-#9: sanitized + retry-capped. Unbounded re-apply of a corrupt target
        // would setTranslation(NaN) forever — poisoning the body and every attached
        // PositionalAudio (linearRamp throws every frame).
        if (pendingTeleport.current) {
            const raw = pendingTeleport.current;
            const t = sanitizeTeleportTarget(raw);
            if (!t) {
                pendingTeleport.current = null;
                teleportRetries.current = 0;
                try {
                    useGameStore.getState().setPendingTeleportTarget(null);
                } catch {}
            } else if ((teleportRetries.current = (teleportRetries.current || 0) + 1) > 60) {
                pendingTeleport.current = null;
                teleportRetries.current = 0;
                try {
                    useGameStore.getState().setPendingTeleportTarget(null);
                } catch {}
                debugWarn("Teleport target unreachable after 60 frames — dropping it");
            } else {
                const current = rigidBodyRef.current.translation();
                const cx = Number(current?.x),
                    cy = Number(current?.y),
                    cz = Number(current?.z);
                if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz)) {
                    // Corrupt body — force it back onto the target and zero all motion.
                    try {
                        rigidBodyRef.current.setTranslation(t, true);
                        rigidBodyRef.current.setLinvel({x: 0, y: 0, z: 0}, true);
                        rigidBodyRef.current.setAngvel({x: 0, y: 0, z: 0}, true);
                    } catch {}
                } else {
                    const dx = cx - t.x,
                        dy = cy - t.y,
                        dz = cz - t.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    // Only clear when actually at target (within 0.5m) — otherwise re-apply
                    if (dist < 0.5) {
                        pendingTeleport.current = null;
                        teleportRetries.current = 0;
                        try {
                            useGameStore.getState().setPendingTeleportTarget(null);
                        } catch {}
                        debugLog("teleport", `✅ Teleport confirmed at (${t.x.toFixed(1)}, ${t.y}, ${t.z.toFixed(1)})`);
                    } else {
                        // Re-apply: wake, translate, zero velocity — loop keeps firing
                        try {
                            rigidBodyRef.current.wakeUp();
                            rigidBodyRef.current.setTranslation({x: t.x, y: t.y, z: t.z}, true);
                            rigidBodyRef.current.setLinvel({x: 0, y: 0, z: 0}, true);
                            rigidBodyRef.current.setAngvel({x: 0, y: 0, z: 0}, true);
                        } catch {}

                        if (sendUpdate) sendUpdate({pos: [t.x, t.y, t.z], force: true});
                    }
                }
            }
        } // end pendingTeleport

        // Check power-up expiration
        const powerUp = useGameStore.getState().powerUp;
        if (powerUp && Date.now() >= powerUp.expiresAt) {
            useGameStore.getState().clearPowerUp();
        }

        // Apply pending respawn (death or restart → lobby Platform 1)
        if (pendingRespawn.current) {
            pendingRespawn.current = false;
            useGameStore.getState().clearPowerUp();
            rigidBodyRef.current.wakeUp();
            rigidBodyRef.current.setTranslation({x: 0, y: 103, z: 0}, true);
            rigidBodyRef.current.setLinvel({x: 0, y: 0, z: 0}, true);
            rigidBodyRef.current.setAngvel({x: 0, y: 0, z: 0}, true);
            rotationY.current = Math.PI;
            smoothRotY.current = Math.PI;
            targetRotationY.current = Math.PI;
            if (playerGroupRef.current) {
                playerGroupRef.current.rotation.y = Math.PI;
            }
            try {
                gl.domElement.requestPointerLock();
            } catch {
                debugWarn("Pointer lock request failed");
            }
            if (sendUpdate) sendUpdate({pos: [0, 103, 0], force: true});
            return;
        }

        const playerPos = translation;

        // Kill Plane
        if (playerPos.y < -250) {
            rigidBodyRef.current.setTranslation({x: 0, y: 103, z: 0}, true);
            rigidBodyRef.current.setLinvel({x: 0, y: 0, z: 0}, true);
            rotationY.current = Math.PI;
            smoothRotY.current = Math.PI;
            targetRotationY.current = Math.PI;

            if (playerGroupRef.current) {
                playerGroupRef.current.rotation.y = Math.PI; // Match targetRotationY
            }
            if (sendUpdate) sendUpdate({pos: [0, 103, 0], force: true});
            return;
        }

        // P0-#3: freeze the simulation unless the state is a live-play state.
        // The old check only froze MENU: PAUSED kept running movement, setLinvel,
        // ground/camera casts, loop sounds and net broadcasts — burning CPU,
        // desyncing reconciliation, and stepping on half-torn-down graphs.
        const liveState = useGameStore.getState().game.state;
        const menuOpen = liveState === "MENU";
        const simPaused = !SIM_RUNNING_STATES.has(liveState);
        if (simPaused) {
            // Silence movement loops so PAUSED doesn't keep panning 3D audio.
            stopLoopSound(slideSoundRef);
            return;
        }
        // Input Aggregation (Keyboard + Mobile) — locked during dash.
        // Every contributor is sanitized: undefined gamepad axes (disconnected pad),
        // NaN mobile input, or a corrupt store value would otherwise produce NaN
        // velocity -> NaN body -> NaN mesh -> PositionalAudio panner throws forever.
        const finiteNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };
        let moveX, moveZ, walkingInput, jumpingInput, slidingInput;
        if (isDashing.current || menuOpen) {
            moveX = 0;
            moveZ = 0;
            walkingInput = false;
            jumpingInput = false;
            slidingInput = false;
        } else {
            moveX =
                (keys.right ? 1 : 0) -
                (keys.left ? 1 : 0) +
                finiteNum(mobileInput.x) +
                (gp ? finiteNum(gp.axes.lx) : 0);
            moveZ =
                (keys.backward ? 1 : 0) -
                (keys.forward ? 1 : 0) -
                finiteNum(mobileInput.y) +
                (gp ? finiteNum(gp.axes.ly) : 0);
            if (!Number.isFinite(moveX)) moveX = 0;
            if (!Number.isFinite(moveZ)) moveZ = 0;
            walkingInput = !!(keys.walk || mobileInput.walk || (gp && gp.buttons[6] && gp.buttons[6].pressed));
            jumpingInput = !!(keys.jump || mobileInput.jump || (gp && gp.buttons[2] && gp.buttons[2].pressed));
            slidingInput = !!(keys.slide || mobileInput.slide || (gp && gp.buttons[7] && gp.buttons[7].pressed));
        }
        const dashInput = !!(keys.dash || mobileInput.dash || (gp && gp.buttons[1] && gp.buttons[1].pressed));

        // Dash cooldown
        if (dashCooldown.current > 0) dashCooldown.current -= delta;

        // Dash activation
        if (dashInput && !prevDashInput.current && !isDashing.current && dashCooldown.current <= 0) {
            const dashPowerUp = useGameStore.getState().powerUp;
            if (canUseDash(dashPowerUp)) {
                isDashing.current = true;
                setIsDashingVisual(true);
                dashStartPos.current.copy(rigidBodyRef.current.translation());
                // Store dash direction in camera forward (flat on XZ)
                dashDir.current = new THREE.Vector3(0, 0, -1).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    rotationY.current
                );
                // Lock player visual rotation to face dash direction (does NOT touch camera)
                targetRotationY.current = Math.atan2(dashDir.current.x, dashDir.current.z);
                if (playerGroupRef.current) {
                    const targetQuat = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 1, 0),
                        targetRotationY.current
                    );
                    playerGroupRef.current.quaternion.copy(targetQuat);
                }
                // Snap pre-dash velocity to zero so dash speed is clean
                rigidBodyRef.current.setLinvel({x: 0, y: rigidBodyRef.current.linvel().y, z: 0}, true);
                // Enable radial blur
                useGameStore.getState().setDashBlur(true);
                // Trigger rippleDisplace on dash (not shockwave)
                triggerRipple();
                debugLog(
                    "powerup",
                    "DASH ACTIVATED — powerUp:",
                    dashPowerUp?.category || "none",
                    dashPowerUp?.rarity || "none"
                );
                // --- Dash sound (same strategy as slide sound) ---
                // Release any existing dash sound so a fresh one plays on every dash start.
                if (dashSoundRef.current) {
                    stopLoopSound(dashSoundRef);
                    dashSoundRef.current = null;
                }
                dashSoundRef.current = soundManager.playPositional(
                    "dash",
                    playerGroupRef.current,
                    1.0,
                    5,
                    1.0,
                    50,
                    false
                );
            }
        }

        // Dash timer + wall collision stop
        if (isDashing.current) {
            // Stop dash if horizontal speed drops (hit a wall)
            const vel = rigidBodyRef.current.linvel();
            const hSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
            const dashConfig = getDashConfig(useGameStore.getState().powerUp?.rarity);
            const currentPos = rigidBodyRef.current.translation();
            const travelDistance = Math.sqrt(
                (currentPos.x - dashStartPos.current.x) ** 2 + (currentPos.z - dashStartPos.current.z) ** 2
            );
            if (shouldEndDash({travelDistance, maxDistance: dashConfig.maxDistance, hSpeed})) {
                isDashing.current = false;
                setIsDashingVisual(false);
                dashCooldown.current = getDashConfig(useGameStore.getState().powerUp?.rarity).cooldown;
                rigidBodyRef.current.setLinvel({x: 0, y: vel.y, z: 0}, true);
                useGameStore.getState().setDashBlur(false);
                debugLog("dash", "DASH ENDED");
                // Start rapid fade-out of the dash sound when dash ends.
                if (dashSoundRef.current) {
                    dashFadeRef.current = true;
                }
            }
        }

        // Reliable ground detection via ShapeCast (SphereCast)
        // Replaces the single thin RayCast so that standing on edges works correctly
        let currentlyGrounded = false;
        let veryCloseToGround = false;
        // Snapshot origin into plain numbers: feeding live WASM proxies or NaN into castShape
        // traps the query (unreachable) and later triggers unsafe-aliasing panics.
        const probePos =
            playerPos && Number.isFinite(playerPos.x) && Number.isFinite(playerPos.y) && Number.isFinite(playerPos.z)
                ? {x: playerPos.x, y: playerPos.y, z: playerPos.z}
                : null;

        try {
            if (!probePos) throw new Error("skip-ground-probe");
            // Lazy initialize the ground check shape once
            if (playerGroupRef.current && !playerGroupRef.current.userData._groundShape) {
                playerGroupRef.current.userData._groundShape = new rapier.Ball(0.3); // Match player radius
            }

            if (playerGroupRef.current?.userData?._groundShape) {
                const groundShape = playerGroupRef.current.userData._groundShape;
                const shapeRotation = {w: 1.0, x: 0.0, y: 0.0, z: 0.0};
                const rayDirG = {x: 0, y: -1, z: 0};

                // 1. Glue Sensor (Long): Keeps physics stable
                const glueHit = world.castShape(
                    probePos,
                    shapeRotation,
                    rayDirG,
                    groundShape,
                    0.0,
                    2.6, // Distance from center for 5m pill (bottom is at -2.5)
                    true,
                    null,
                    0x00010001,
                    null,
                    rigidBodyRef.current
                );
                currentlyGrounded = glueHit !== null;

                // 2. Impact Sensor (Short): Only triggers landing animation when very close to ground
                const impactHit = world.castShape(
                    probePos,
                    shapeRotation,
                    rayDirG,
                    groundShape,
                    0.0,
                    2.6,
                    true,
                    null,
                    0x00010001,
                    null,
                    rigidBodyRef.current
                );
                veryCloseToGround = impactHit !== null;
            }
        } catch {
            // Fallback if castShape fails for some reason during hot-reload
            currentlyGrounded = false;
        }

        // Sync refs for the footstep callback (stable useCallback outside useFrame)
        currentlyGroundedRef.current = currentlyGrounded;

        // 1. PHASE HANDLING: Freeze player during PREMATCH and DROP
        if (matchPhase === "PREMATCH" || (matchPhase === "DROP" && countdown > 0)) {
            rigidBodyRef.current.setLinvel({x: 0, y: 0, z: 0}, true);
            return;
        }

        // Determine movement direction vector
        frontVector.set(0, 0, moveZ);
        sideVector.set(-moveX, 0, 0);
        direction.subVectors(frontVector, sideVector);
        const moving = direction.lengthSq() > 0.01;

        // DEBUG: Only log if we are moving or if we just stopped
        if (moving || isMoving) {
            // debugLog(`[Move Debug] moveX: ${moveX.toFixed(2)}, moveZ: ${moveZ.toFixed(2)}, moving: ${moving}`);
        }

        // 2. SLIDE LOGIC
        // Decay slide cooldown each frame
        if (slideCooldown.current > 0) slideCooldown.current -= delta;

        if (slidingInput && !isSliding && currentlyGrounded && moving && !walkingInput && slideCooldown.current <= 0) {
            setIsSliding(true);
            // Tie slide duration to horizontal velocity — if blocked by an obstacle
            // (low velocity), the slide is very brief. If moving freely, full duration.
            const slideStartVel = rigidBodyRef.current.linvel();
            const slideHSpeed = Math.sqrt(slideStartVel.x * slideStartVel.x + slideStartVel.z * slideStartVel.z);
            // Scale slide duration: 0.1s at low speed, up to 0.6s at full speed
            const slideDuration = Math.max(0.1, Math.min(0.6, slideHSpeed / 10));
            slideTimer.current = slideDuration;
            intendedSlideDuration.current = slideDuration;

            // Add a burst of speed
            direction.multiplyScalar(1.5);
            // Ensure we don't carry upward momentum when starting a slide
            const curVel = rigidBodyRef.current.linvel();
            rigidBodyRef.current.setLinvel({x: curVel.x, y: Math.min(curVel.y, 0), z: curVel.z}, true);
            // Force player down a little to stay close to ground
            // removed duplicate curVel declaration
            rigidBodyRef.current.setLinvel({x: curVel.x, y: -5, z: curVel.z}, true);
            // --- AUDIO DEBUG (bisect step 1) -------------------------------------
            // The slide-sound block is gated behind the `slideSound` debug flag
            // so we can toggle it from the console during bisecting.
            //
            //   audioDebug.set('slideSound', true)   // re-enable the slide sound
            //   audioDebug.set('slideSound', false)  // disable the slide sound
            //
            // Enable slide sound — plays at player position with volume based on horizontal speed
            const slideFlag = audioFlag("slideSound");

            if (slideFlag) {
                // Release any existing slide sound so a fresh one plays on every slide start.
                // Without this, the old fading-out sound blocks creation of a new one.
                if (slideSoundRef.current) {
                    stopLoopSound(slideSoundRef);
                    slideSoundRef.current = null;
                }

                slideSoundRef.current = soundManager.playPositional(
                    "slide",
                    playerGroupRef.current,
                    1.0,
                    5,
                    1.0,
                    50,
                    false
                );
            }
        }

        if (isSliding) {
            slideTimer.current -= delta;
            if (slideTimer.current <= 0 || !currentlyGrounded) {
                setIsSliding(false);
                // Set slide cooldown to prevent spamming when blocked by an obstacle.
                // Cooldown scales with how brief the slide was — short slides (blocked)
                // get a shorter cooldown, full slides get a longer one.
                slideCooldown.current = Math.max(0.3, intendedSlideDuration.current / 2);

                // Start rapid fade-out of the slide sound when sliding stops.
                if (audioFlag("slideSound") && slideSoundRef.current) {
                    slideFadeRef.current = true;
                }
            }
        }

        // Rapid fade-out of the slide sound — runs every frame until volume reaches 0.
        // Gated by slideFadeRef (not isSliding) so the fade continues across frames
        // after setIsSliding(false) has been called.
        if (slideFadeRef.current && slideSoundRef.current) {
            if (!audioFlag("slideSound")) {
                stopLoopSound(slideSoundRef);
                slideSoundRef.current = null;
                slideFadeRef.current = false;
            } else {
                try {
                    // THREE.Audio uses .volume property, not .getVolume() method
                    // Rapid fade: drop volume by ~5 per second (0.05 per 10ms frame)
                    const cur = Number.isFinite(slideSoundRef.current.volume) ? slideSoundRef.current.volume : 1.0;
                    const next = Math.max(0, cur - 6 * delta);
                    slideSoundRef.current.volume = next;

                    if (next <= 0.01) {
                        // P0-#2: defer the detach — an inline parent.remove() here splices
                        // the children array while three is traversing it.
                        stopLoopSound(slideSoundRef);
                        slideSoundRef.current = null;
                        slideFadeRef.current = false;
                    }
                } catch {
                    stopLoopSound(slideSoundRef);
                    slideSoundRef.current = null;
                    slideFadeRef.current = false;
                }
            }
        } else if (slideSoundRef.current && !audioFlag("slideSound")) {
            stopLoopSound(slideSoundRef);
            slideSoundRef.current = null;
        }

        // Rapid fade-out of the dash sound — runs every frame until volume reaches 0.
        // Gated by dashFadeRef (not isDashing) so the fade continues across frames
        // after the dash has ended.
        if (dashFadeRef.current && dashSoundRef.current) {
            try {
                // THREE.Audio uses .volume property, not .getVolume() method
                // Rapid fade: drop volume by ~5 per second (0.05 per 10ms frame)
                const cur = Number.isFinite(dashSoundRef.current.volume) ? dashSoundRef.current.volume : 1.0;
                const next = Math.max(0, cur - 6 * delta);
                dashSoundRef.current.volume = next;
                if (next <= 0.01) {
                    stopLoopSound(dashSoundRef);
                    dashSoundRef.current = null;
                    dashFadeRef.current = false;
                }
            } catch {
                stopLoopSound(dashSoundRef);
                dashSoundRef.current = null;
                dashFadeRef.current = false;
            }
        } else if (dashSoundRef.current && !dashFadeRef.current) {
            // Dash is still active and the sound is playing — let it play through.
            // Do NOT release it here; the one-shot will stop on its own via onEnded,
            // or be faded out when dashFadeRef becomes true (dash ended).
        }

        // 3. PASSIVE REGENERATION (Heals if not damaged for 5s)
        if (Date.now() - lastDamageTime.current > 5000 && playerHealth < 100) {
            healPlayer(10 * delta); // Heal 10 HP per second
        }

        const currentPowerUp = useGameStore.getState().powerUp;
        const hasSpeedPowerUp = currentPowerUp?.category === "speed";
        const speedMultiplier = hasSpeedPowerUp
            ? getPowerUpEffect("speed", currentPowerUp.rarity, "speedMultiplier")
            : 1;
        const slideSpeed = PLAYER_BASELINE.movement.slideSpeed;
        const speed = isSliding
            ? slideSpeed * speedMultiplier
            : (walkingInput ? WALK_SPEED : SPRINT_SPEED) * speedMultiplier;

        // apply speed and rotation to direction
        if (direction.lengthSq() > 0) {
            direction.normalize().multiplyScalar(speed).applyAxisAngle(upAxis, rotationY.current);
        }

        const currentVelocity = rigidBodyRef.current.linvel();

        // --- VELOCITY-BASED ANIMATION STATE ---
        // Tie animations to actual horizontal velocity, not input.
        // If the player is blocked by an obstacle (velocity ≈ 0), no walk/run animation plays.
        // If running but velocity is low (blocked sideways), walk animation plays instead.
        const hSpeed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.z * currentVelocity.z);
        hSpeedRef.current = hSpeed; // Sync for animation speed in PlayerModel
        const ACTUAL_MOVE_THRESHOLD = 0.5; // m/s — below this, no walk/run animation
        const WALK_SPEED_THRESHOLD = WALK_SPEED * 0.6; // below this = walk, above = run
        const actualMoving = hSpeed > ACTUAL_MOVE_THRESHOLD && currentlyGrounded && jumpPhase === "none";
        const actualWalking = actualMoving && hSpeed < WALK_SPEED_THRESHOLD;
        actualWalkingRef.current = actualWalking;

        // Ground detection already calculated above

        // Calculate max jumps from jump power-up only
        const maxJumps = getMaxJumps(powerUp);

        // Jump State Machine
        let currentPhase = jumpPhase;

        if (currentlyGrounded) {
            setJumpCount(0); // Reset jump count on grounded
            // Only allow landing if moving DOWN (or flat) and VERY CLOSE to the ground
            if (
                (currentPhase === "air" || currentPhase === "doublejump") &&
                currentVelocity.y <= 0.1 &&
                veryCloseToGround
            ) {
                currentPhase = "land";
                const landDuration = (animConfig?.jump?.landFrames || 10) / (30 * 1.6);
                jumpTimer.current = landDuration;
                soundManager.playPositional("land", playerGroupRef.current, 1.0, 5, 1.0, 50, false);
            }

            if (currentPhase === "land" || currentPhase === "none") {
                if (jumpingInput && Math.abs(currentVelocity.y) < 2.0 && animConfig) {
                    const config = !walkingInput ? animConfig.run_jump : animConfig.jump;
                    currentPhase = "launch";
                    jumpTimer.current = config.launchFrames / 30; // Use JSON values
                    physicsJumpTriggered.current = false;
                    setJumpTransitionId((value) => value + 1);
                    soundManager.playPositional("launch", playerGroupRef.current, 1.0, 5, 1.0, 50, false);
                } else if (currentPhase === "land") {
                    jumpTimer.current -= delta;
                    if (jumpTimer.current <= 0 || (direction.lengthSq() > 0.01 && currentlyGrounded)) {
                        currentPhase = "none";
                    }
                }
            }

            if (currentPhase === "launch") {
                jumpTimer.current -= delta;
                const config = jumpLock.current.sprint ? animConfig.run_jump : animConfig.jump;

                // DYNAMIC LIFTOFF: Trigger physics jump at frame 6 (0.2s) regardless of total launch frames
                // This provides snappy feedback while the launch animation continues visually.
                const triggerTime = Math.max(0.05, (config.launchFrames - 6) / 30);
                if (!physicsJumpTriggered.current && jumpTimer.current <= triggerTime) {
                    rigidBodyRef.current.setLinvel({x: currentVelocity.x, y: 38, z: currentVelocity.z}, true);
                    physicsJumpTriggered.current = true;
                }

                if (jumpTimer.current <= 0) {
                    currentPhase = "air";
                }
            }
        } else {
            // We are freely in the air
            if (currentPhase === "none" || currentPhase === "land") {
                currentPhase = "air";
            }

            // DOUBLE JUMP LOGIC
            if (
                (currentPhase === "air" || currentPhase === "launch" || currentPhase === "doublejump") &&
                jumpingInput &&
                !prevJumpingInput.current &&
                jumpCount < maxJumps - 1
            ) {
                rigidBodyRef.current.setLinvel({x: currentVelocity.x, y: 35, z: currentVelocity.z}, true);
                setJumpCount(jumpCount + 1);
                currentPhase = "doublejump";

                const isBack = jumpLock.current.dir === "bac";
                const djConfig = isBack ? animConfig?.doublejump_back : animConfig?.doublejump;
                const frames = djConfig?.frames || 15;
                jumpTimer.current = Math.max(PLAYER_BASELINE.movement.doubleJumpDuration, frames / 30);
                setJumpTransitionId((value) => value + 1);

                soundManager.playPositional("jump", playerGroupRef.current, 1.0, 5, 1.0, 50, false); // Add double jump sound
            }

            if (currentPhase === "doublejump") {
                jumpTimer.current -= delta;
                if (jumpTimer.current <= 0) {
                    currentPhase = "air";
                }
            }

            if (currentPhase === "launch") {
                jumpTimer.current -= delta;
                const config = jumpLock.current.sprint ? animConfig.run_jump : animConfig.jump;

                // Dynamic liftoff even if we fell off a ledge mid-launch
                const triggerTime = Math.max(0.05, (config.launchFrames - 6) / 30);
                if (!physicsJumpTriggered.current && jumpTimer.current <= triggerTime) {
                    rigidBodyRef.current.setLinvel({x: currentVelocity.x, y: 30, z: currentVelocity.z}, true);
                    physicsJumpTriggered.current = true;
                }

                if (jumpTimer.current <= 0) {
                    currentPhase = "air";
                }
            }
        }

        if (jumpPhase !== currentPhase) {
            // When starting a jump, lock the current walk/dir state for the animation
            if (
                jumpPhase === "none" &&
                (currentPhase === "launch" || currentPhase === "air" || currentPhase === "doublejump")
            ) {
                jumpLock.current = {sprint: !walkingInput, dir: moveDir};
            }
            setJumpPhase(currentPhase);
        }

        // Sync currentPhase ref for the footstep callback
        currentPhaseRef.current = currentPhase;

        // Apply Horizontal Velocity ONLY (preserve vertical velocity)
        // ADDITION: Apply and decay external forces (knockback)
        let finalX, finalZ;
        if (isDashing.current) {
            const dashConfig = getDashConfig(useGameStore.getState().powerUp?.rarity);
            const dashVelocity = dashConfig.baseSpeed * dashConfig.speedMultiplier;
            finalX = dashDir.current.x * dashVelocity;
            finalZ = dashDir.current.z * dashVelocity;
        } else {
            finalX = direction.x + externalForce.current.x;
            finalZ = direction.z + externalForce.current.z;
        }
        const finalY = rigidBodyRef.current.linvel().y;

        // Gate velocity application at 30Hz to match server simulation rate.
        // Applying setLinvel every frame (~60fps) causes divergence from server's 30Hz steps.
        // linearDamping={0.5} on the RigidBody matches server's Rapier damping exactly.
        physicsAccumulator.current = (physicsAccumulator.current || 0) + delta;
        if (physicsAccumulator.current >= 0.0333) {
            physicsAccumulator.current -= 0.0333;
            rigidBodyRef.current.setLinvel({x: finalX, y: finalY, z: finalZ}, true);
        }

        // Decay the external force quickly
        externalForce.current.multiplyScalar(Math.max(0, 1 - 8 * delta));
        if (externalForce.current.lengthSq() < 0.1) externalForce.current.set(0, 0, 0);

        // Sync movement direction for animations with hysteresis
        // Use actual velocity-based state, not input-based state
        if (actualMoving !== isMoving) setIsMoving(actualMoving);
        if (actualWalking !== isWalking) setIsWalking(actualWalking);
        // Keep ref in sync for collision handler (avoids stale closure)
        isSlidingRef.current = isSliding;
        // Propagate sliding state to physics body so TinCan can read it
        if (rigidBodyRef.current) {
            rigidBodyRef.current.userData = {...rigidBodyRef.current.userData, isSliding: isSlidingRef.current};
        }

        // Update store with current movement state for post-effects system
        useGameStore.getState().setPlayerMovement(moving, isDashing.current);

        // Contextual movement: Backwards logic
        // Determine if we should walk backwards based on mesh forward vs camera forward
        // P1-#12: reuse scratch vectors instead of allocating two per frame.
        const meshForward = scratchMeshForward.set(0, 0, 1).applyQuaternion(playerGroupRef.current.quaternion);
        const camForward = scratchCamForward.set(0, 0, -1).applyAxisAngle(upAxis, rotationY.current);

        // dot > 0.3 defines a VERY generous ~144-degree detection zone
        // We use a significant hysteresis (0.0 vs 0.3) so that once you start backing up,
        // it's very "sticky" and won't flip until you face almost sideways to the camera.
        const dotThreshold = moveDir === "bac" ? -0.2 : 0.3;
        const facingAwayFromCamera = meshForward.dot(camForward) > dotThreshold;
        const isInputBack = moveZ > 0.05;
        const shouldBackUp = isInputBack && facingAwayFromCamera;

        let currentMoveDir = "for";
        if (!isDashing.current) {
            if (moving) {
                if (shouldBackUp) {
                    currentMoveDir = "bac";
                    targetRotationY.current = rotationY.current + Math.PI;
                } else {
                    currentMoveDir = "for";
                    targetRotationY.current = Math.atan2(direction.x, direction.z);
                }
            }

            // Smoothly rotate the visual mesh towards the target heading
            if (playerGroupRef.current) {
                // P1-#12: reuse the shared quaternion scratch.
                scratchQuat.setFromAxisAngle(upAxis, targetRotationY.current);
                playerGroupRef.current.quaternion.slerp(scratchQuat, 0.2);
            }
        }

        if (currentMoveDir !== moveDir) setMoveDir(currentMoveDir);

        // --- NETWORKING: BROADCAST INPUT & POSITION ---
        // Increment tick based on 30Hz rate (33.3ms) to match server
        netAccumulator.current = (netAccumulator.current || 0) + delta;
        if (netAccumulator.current >= 0.0333) {
            netTick.current = (netTick.current || 0) + 1;
            netAccumulator.current -= 0.0333;

            const currentInput = {
                w: !!keys.forward,
                a: !!keys.left,
                s: !!keys.backward,
                d: !!keys.right,
                jump: jumpingInput,
                walk: walkingInput,
                slide: slidingInput,
                dash: dashInput,
            };

            if (sendUpdate) {
                // Send INPUT for the NEXT tick (netTick + 1). By the time the server
                // receives this packet after network latency, it will be at tick netTick+1
                // and can process this input at the correct tick. Sending the current tick
                // causes one-tick desync because the server is already ahead by the time
                // the packet arrives.
                const sequenceId = sendUpdate({
                    type: "input",
                    tick: netTick.current + 1,
                    input: currentInput,
                    camRot: rotationY.current,
                    facingRot: targetRotationY.current,
                });

                // Track sent input by sequenceId for reconciliation (Phase 01).
                // The server echoes back the processed tick; we use sequenceId to match
                // acknowledgments and re-apply any unacknowledged inputs.
                if (sequenceId !== undefined) {
                    sentInputs.current.set(sequenceId, {
                        tick: netTick.current + 1,
                        pos: {
                            x: rigidBodyRef.current.translation().x,
                            y: rigidBodyRef.current.translation().y,
                            z: rigidBodyRef.current.translation().z,
                        },
                        input: currentInput,
                        camRot: rotationY.current,
                        facingRot: targetRotationY.current,
                    });
                }

                // 2. Send LEGACY POSITION (Phase 1/2 Bridge)
                const pos = rigidBodyRef.current.translation();

                if (netTick.current % 2 === 0) {
                    sendUpdate({
                        pos: [pos.x, pos.y, pos.z],
                        rot: rotationY.current,
                        facingRot: targetRotationY.current,
                        anim: {
                            mv: moving,
                            dir: currentMoveDir,
                            jp: currentPhase,
                            spr: !walkingInput,
                        },
                    });
                }

                // 3. Record History for Reconciliation
                // Record with netTick.current + 1 to match the tick we sent to the server,
                // so reconciliation can find this entry when serverState.tick matches.
                inputHistory.current.push({
                    tick: netTick.current + 1,
                    pos: {x: pos.x, y: pos.y, z: pos.z},
                    input: currentInput,
                    camRot: rotationY.current,
                    facingRot: targetRotationY.current,
                });

                // Keep history buffer manageable (2 seconds @ 60fps = 120 entries)
                if (inputHistory.current.length > 120) {
                    inputHistory.current.shift();
                }
            }
        }

        // ----------------------------------------------------
        // OPTIMIZED 3RD PERSON CAMERA LOGIC (Rubber-banding & Raycast)
        // ----------------------------------------------------

        // Apply camera joystick input from store (touch devices)
        const camInput = useGameStore.getState().cameraInput;
        if (camInput.x !== 0 || camInput.y !== 0) {
            rotationY.current += camInput.x;
            rotationX.current += camInput.y;
            rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));
            // Reset after applying so it doesn't compound
            useGameStore.getState().setCameraInput({x: 0, y: 0});
        }

        // 1. Smooth the raw inputs
        const rawRotY = isNaN(rotationY.current) ? 0 : rotationY.current;
        const rawRotX = isNaN(rotationX.current) ? 0 : rotationX.current;
        const rawZoom = isNaN(zoomDistance.current) ? 12 : zoomDistance.current;

        smoothRotY.current = THREE.MathUtils.damp(smoothRotY.current, rawRotY, 20, delta);
        smoothRotX.current = THREE.MathUtils.damp(smoothRotX.current, rawRotX, 20, delta);
        smoothZoom.current = THREE.MathUtils.damp(smoothZoom.current, rawZoom, 15, delta); // Expected zoom

        // 2. Determine camera direction vector
        // P1-#12: reuse scratch vectors instead of allocating 3 per frame.
        const cameraOffset = scratchCamOffset.set(0, 0, 1);
        cameraOffset.applyAxisAngle(rightAxis, smoothRotX.current);
        cameraOffset.applyAxisAngle(upAxis, smoothRotY.current);
        rayDirection.copy(cameraOffset).normalize();

        // 3. Define the Ray Origin (Target Point) with smoothing
        // We smooth the anchor point to give a "cinematic" follow feel to the camera's orbit center.
        if (!camera.userData.smoothedTarget) camera.userData.smoothedTarget = new THREE.Vector3().copy(playerPos);
        const targetYOffset = 1;
        const currentTarget = scratchTarget.set(playerPos.x, playerPos.y + targetYOffset, playerPos.z);

        camera.userData.smoothedTarget.lerp(currentTarget, 1 - Math.exp(-15 * delta));
        const rayOrigin = camera.userData.smoothedTarget;

        // 4. ShapeCast — sweep from PLAYER CENTER with a fixed ball.
        // The collision is always centered on the player, symmetric in all directions.
        // The shoulder offset only affects the final camera position, NOT the sweep.
        // This ensures collision sensitivity is the same regardless of pan direction.
        let maxSafeDist = smoothZoom.current;

        try {
            const sweepRadius = 0.5;
            if (!camera.userData._cameraShape || camera.userData._sweepRadius !== sweepRadius) {
                camera.userData._cameraShape = new rapier.Ball(sweepRadius);
                camera.userData._sweepRadius = sweepRadius;
            }

            const shapeRotation = {w: 1.0, x: 0.0, y: 0.0, z: 0.0};
            const shapeVelocity = {x: rayDirection.x, y: rayDirection.y, z: rayDirection.z};
            const collisionOrigin = {x: playerPos.x, y: playerPos.y + targetYOffset, z: playerPos.z};

            // castShape(shapePos, shapeRot, shapeVel, shape, targetDistance, maxToi, stopAtPenetration, filterFlags, filterGroups, filterExcludeCollider, filterExcludeRigidBody)
            const hit = world.castShape(
                collisionOrigin,
                shapeRotation,
                shapeVelocity,
                camera.userData._cameraShape,
                1.0, // targetDistance (0 = detect all hits)
                smoothZoom.current, // maxToi (max sweep distance)
                false, // stopAtPenetration (false = only detect obstacles the sweep REACHES, not overlaps)
                null, // filterFlags
                0x00010001, // filterGroups
                null, // filterExcludeCollider
                rigidBodyRef.current // filterExcludeRigidBody (player body)
            );

            if (hit) {
                const toi = hit.toi ?? hit.time_of_impact;
                if (typeof toi === "number" && isFinite(toi)) {
                    maxSafeDist = toi;
                }
            }
        } catch (e) {
            // Fallback: single ray from player center
            debugWarn("[Camera] castShape error:", e.message);
            const fbOrigin = {x: playerPos.x, y: playerPos.y + targetYOffset, z: playerPos.z};
            const ray = new rapier.Ray(fbOrigin, rayDirection);
            const backupHit = world.castRay(
                ray,
                smoothZoom.current,
                false,
                null,
                0x00010001,
                null,
                rigidBodyRef.current
            );
            if (backupHit) maxSafeDist = Math.max(0.5, backupHit.toi - 0.5);
        }
        // Hard clamp to ensure the camera doesn't flip through the target
        maxSafeDist = Math.max(0.1, maxSafeDist);

        // 5. Rubber-band interpolation of the ACTUAL zoom distance
        if (camera.userData.currentZoom === undefined || isNaN(camera.userData.currentZoom)) {
            camera.userData.currentZoom = DEFAULT_ZOOM;
        }

        // Touch auto-return: after 3s of no pinch/scroll on touch devices, drift back to default
        if (isTouchDevice.current && Date.now() - lastPinchTime.current > 3000) {
            intendedZoom.current = THREE.MathUtils.damp(intendedZoom.current, DEFAULT_ZOOM, 2, delta);
            zoomDistance.current = intendedZoom.current;
        }

        if (camera.userData.currentZoom > maxSafeDist) {
            // Collision detected — ease inward gradually to avoid the "jump" effect
            camera.userData.currentZoom = THREE.MathUtils.damp(camera.userData.currentZoom, maxSafeDist, 10, delta);
        } else {
            // Path is clear — recover toward intended zoom (what the user set)
            camera.userData.currentZoom = THREE.MathUtils.damp(
                camera.userData.currentZoom,
                intendedZoom.current,
                12,
                delta
            );
            // Also clamp to maxSafeDist so we never go through geometry
            camera.userData.currentZoom = Math.min(camera.userData.currentZoom, maxSafeDist);
        }

        // Prevent NaN corruption
        if (isNaN(camera.userData.currentZoom) || !isFinite(camera.userData.currentZoom)) {
            camera.userData.currentZoom = DEFAULT_ZOOM;
        }

        // 6. Calculate absolute camera coordinates
        camPos.copy(rayOrigin).addScaledVector(rayDirection, camera.userData.currentZoom);

        // Final Validation & Fluid Application
        if (!isNaN(camPos.x) && !isNaN(camPos.y) && !isNaN(camPos.z)) {
            // Direct assignment instead of lerp!
            // Lerping position cuts corners into geometry, causing the camera to clip through walls and floors.
            camera.position.copy(camPos);

            // Hide player model if camera is squished against the wall
            if (playerGroupRef.current) {
                playerGroupRef.current.visible = camera.userData.currentZoom > 1.2;
            }
        }

        // Look past the shoulder into the distance so the crosshair points at the world
        const lookDistance = 100;
        // Rotate the look direction 5° to the right (Y-axis) for an over-the-shoulder feel.
        // This shifts the VIEW right without moving the camera position, keeping collision perfectly centered.
        // P1-#12: reuse scratch vectors instead of allocating 3 per frame.
        const lookDir = scratchLookDir.copy(rayDirection).applyAxisAngle(upAxis, -10 * (Math.PI / 180));
        const lookTarget = scratchLookTarget.copy(rayOrigin).addScaledVector(lookDir, -lookDistance);
        camera.lookAt(lookTarget);

        // Track World Velocity for Newtonian Prediction
        const currentVel = rigidBodyRef.current.linvel();
        worldVelocityRef.current.set(currentVel.x, currentVel.y, currentVel.z);

        // Memory: Save velocity from frame BEFORE impact
        if (isSliding && !preImpactVelocity.current.lengthSq()) {
            preImpactVelocity.current.copy(worldVelocityRef.current);
        } else if (!isSliding) {
            preImpactVelocity.current.set(0, 0, 0);
        }

        prevJumpingInput.current = jumpingInput;
        prevDashInput.current = dashInput;

        // --- VICTIM AUTHORITY ---
        // If we were recently hit, we need to send our position more frequently
        // to ensure everyone else's "Magnet" knows where we actually landed.
        if (knockbackCount > 0 && netTick.current % 2 === 0) {
            const pos = rigidBodyRef.current.translation();
            sendUpdate({
                pos: [pos.x, pos.y, pos.z],
                rot: targetRotationY.current,
                skin: selectedSkin,
            });
        }
    });
    //logs useFrame time to console
    //console.timeEnd("useFrame");

    /**
     * NEWTONIAN KNOCKBACK
     * Applies a physical impulse to the character.
     */

    const impactTracker = useRef(new Set());

    const handleCollision = (e) => {
        try {
            if (!rigidBodyRef.current) return;

            // Only react to collisions with physics bodies that have a userData flag
            const other = e.other.rigidBody;
            if (!other || !other.userData) return;

            // Only process impacts with players, tin cans, and bot opponents
            const isPlayer = other.userData?.type === "player";
            const isBot = other.userData?.type === "bot-player";
            const isTinCan = other.userData?.type === "tinCan";
            if (!isPlayer && !isBot && !isTinCan) return;

            // Snapshot the WASM refs ONCE into plain numbers. Holding live proxies
            // across playPositional/applyImpulse re-enters the Rapier JS wrapper and
            // trips "recursive use ... unsafe aliasing in rust".
            let attackerSnap, victimSnap, attackerVelSnap;
            try {
                const a = rigidBodyRef.current.translation();
                const v = other.translation();
                const av = other.linvel();
                if (![a.x, a.y, a.z, v.x, v.y, v.z, av.x, av.z].every(Number.isFinite)) return;
                attackerSnap = {x: a.x, y: a.y, z: a.z};
                victimSnap = {x: v.x, y: v.y, z: v.z};
                attackerVelSnap = {x: av.x, z: av.z};
            } catch {
                return;
            }

            // Avoid duplicate ripple triggers for the same object within a short window.
            // TinCan collisions are excluded — TinCanPhysics has its own cooldown,
            // and the 2s window here would block rapid re-impacts during sliding.
            if (!isTinCan) {
                const uniqueId = other.userData?.id ?? `tinCan_${e.contactPoint?.x}`;
                if (impactTracker.current.has(uniqueId)) return;
                impactTracker.current.add(uniqueId);
                // Clean up the id after a brief window so future collisions can be detected again
                setTimeout(() => impactTracker.current.delete(uniqueId), 2000);
            }

            if (isTinCan && isSlidingRef.current) {
                // Volume scales with player speed and powerup impact multiplier
                const playerSpeed = Math.hypot(worldVelocityRef.current.x, worldVelocityRef.current.z);
                const slidePowerUp = useGameStore.getState().powerUp;
                const hasSlidePowerUp = slidePowerUp?.category === "slide";
                const blastPowerMultiplier = hasSlidePowerUp
                    ? getPowerUpEffect("slide", slidePowerUp.rarity, "blastPowerMultiplier")
                    : 1;
                const hitVol = Math.min(Math.max(playerSpeed / 80, 0.1) * blastPowerMultiplier, 2);
                soundManager.playPositional("metal-hit", playerGroupRef.current, hitVol, 10, 1.0, 50, false);
                debugLog(
                    "sound",
                    `metal-hit slide speed(${playerSpeed})/80 * blastPowerMultiplier(${blastPowerMultiplier}) = hitVol(${hitVol}) `
                );
            }

            // Only react to sliding attacks (not when we are the victim)
            if (isSlidingRef.current) {
                debugLog("impact", "🛠️ LOCAL COLLISION: sliding:", isSlidingRef.current, "target:", other.userData?.id);
                debugLog("impact", "💥 Slide IMPACT! Launching Victim...");

                // --- SLIDE TERMINATION ON IMPACT ---
                // When a sliding player collides with an obstacle that impacts their
                // velocity, end the slide immediately (animation + sound).
                // A simple clip off the side won't trigger this — only real impacts.
                if (isSliding && slideSoundRef.current) {
                    setIsSliding(false);
                    slideFadeRef.current = true;
                }

                // 1. PHYSICAL KICK (Newtonian Interaction)
                // We apply an impulse to the other body locally on our screen
                // so they fly away instantly without waiting for the network.
                // Use the snapshots taken at the top (never re-read live WASM proxies).
                const attackerPos = attackerSnap;
                const victimPos = victimSnap;
                const dvx = victimPos.x - attackerPos.x;
                const dvz = victimPos.z - attackerPos.z;
                const dLen = Math.hypot(dvx, dvz);
                if (!Number.isFinite(dLen) || dLen < 1e-4) return;
                const hitDir = new THREE.Vector3(dvx / dLen, 0, dvz / dLen);

                const slidePowerUp = useGameStore.getState().powerUp;
                const hasSpeedPowerUp = slidePowerUp?.category === "speed";
                const hasSlidePowerUp = slidePowerUp?.category === "slide";

                const blastPowerMultiplier = hasSlidePowerUp
                    ? getPowerUpEffect("slide", slidePowerUp.rarity, "blastPowerMultiplier")
                    : 1;
                const knockbackReduction = hasSpeedPowerUp
                    ? getPowerUpEffect("speed", slidePowerUp.rarity, "knockbackReduction")
                    : 1;

                const slideMultiplier = blastPowerMultiplier * knockbackReduction;
                const BLAST_POWER = PLAYER_BASELINE.knockback.baseBlastPower * slideMultiplier;
                const UPWARD_POP = hasSpeedPowerUp
                    ? PLAYER_BASELINE.knockback.speedUpwardPop
                    : PLAYER_BASELINE.knockback.baseUpwardPop;
                debugLog("collision", "🚀 BLASTING Victim with Force:", BLAST_POWER, "Up:", UPWARD_POP);

                // Visual effects at the contact point (shared by both bot and human victims)
                const contactPoint = e.contactPoint;
                // Fallback to player position if contactPoint is not available from Rapier
                const shockwavePos = contactPoint
                    ? [contactPoint.x, contactPoint.y, contactPoint.z]
                    : [attackerPos.x, attackerPos.y, attackerPos.z];
                const currentPowerUp = useGameStore.getState().powerUp;
                const shockwaveIntensity = getActionIntensity("slideImpact", currentPowerUp?.rarity || "none");

                if (isBot) {
                    // Bots are kinematic (their position is driven by BotPlayer, not physics),
                    // so `applyImpulse` would have no visible effect. Route the impact through
                    // the bot registry so the bot takes damage + kinematic knockback like it
                    // would from another bot, and log the impact the same way the human-vs-human
                    // path does.
                    //
                    // Newtonian resolution: only blast the bot if WE are the aggressor — i.e.
                    // our velocity is driving into it (position + direction + speed). If the bot
                    // is the one sliding into us, its own slide-attack system owns our knockback,
                    // so we must NOT also launch it here (that double-launch is the reported bug:
                    // "player slides into a sliding bot and still gets knocked back").
                    const botVel = getBotVelocity(other.userData.id) || {x: 0, z: 0};
                    const bvx = Number(botVel.x ?? 0);
                    const bvz = Number(botVel.z ?? 0);
                    const impact = resolveImpact(
                        {
                            x: attackerPos.x,
                            z: attackerPos.z,
                            vx: worldVelocityRef.current.x,
                            vz: worldVelocityRef.current.z,
                        },
                        {
                            x: victimPos.x,
                            z: victimPos.z,
                            vx: Number.isFinite(bvx) ? bvx : 0,
                            vz: Number.isFinite(bvz) ? bvz : 0,
                        }
                    );
                    if (impact.aggressor === "a") {
                        debugLog(
                            "impact",
                            "🤖 Slide IMPACT! Player drove into bot:",
                            other.userData?.name,
                            `(closing ${impact.closingSpeed.toFixed(1)} m/s)`
                        );
                        applyBotKnockback(other.userData.id, impact.knockDir, BLAST_POWER);
                        damageBot(other.userData.id, BOT_COMBAT.hitDamage, "local");
                        addShockwave(shockwavePos, shockwaveIntensity);
                        triggerRipple();
                        triggerSlideImpact();
                        // Hit sound — volume scales with closing speed
                        const hitVol = computeHitVolume(impact.closingSpeed);
                        try {
                            soundManager.playPositional("hit", playerGroupRef.current, hitVol, 5, 1.0, 50, false);
                        } catch {}
                    } else {
                        // The bot is driving into us — defer. Its slide system applies our knockback.
                        debugLog(
                            "impact",
                            "🛡️ Bot drove into player:",
                            other.userData?.name,
                            `(closing ${impact.closingSpeed.toFixed(1)} m/s) — deferring to the bot's impact`
                        );
                    }
                } else {
                    // Dynamic (networked human) victims respond to a real physics impulse
                    try {
                        const safeBlast = Number.isFinite(BLAST_POWER) ? Math.min(Math.max(BLAST_POWER, 0), 50000) : 0;
                        const safePop = Number.isFinite(UPWARD_POP) ? Math.min(Math.max(UPWARD_POP, -500), 500) : 0;
                        if ([hitDir.x, hitDir.z].every(Number.isFinite)) {
                            other.applyImpulse(
                                {
                                    x: hitDir.x * safeBlast,
                                    y: safePop,
                                    z: hitDir.z * safeBlast,
                                },
                                true
                            );
                        }
                    } catch {}

                    // All impacts use shockwave
                    addShockwave(shockwavePos, shockwaveIntensity);
                    debugLog("impact", "💥 Impact — shockwave triggered");

                    // Hit sound — volume scales with closing speed (attacker's horizontal speed)
                    const hitVol = computeHitVolume(Math.hypot(worldVelocityRef.current.x, worldVelocityRef.current.z));
                    try {
                        soundManager.playPositional("hit", playerGroupRef.current, hitVol, 5, 1.0, 50, false);
                    } catch {}

                    // Send network message for server validation
                    if (sendUpdate) {
                        sendUpdate({
                            type: "impact",
                            victimId: other.userData.id,
                            dir: [hitDir.x, hitDir.y, hitDir.z],
                            position: contactPoint ? [contactPoint.x, contactPoint.y, contactPoint.z] : null,
                            slideMultiplier,
                        });
                    }
                }
            }
            // end isSliding
            // 2. I am the VICTIM (A sliding player hit me!)
            else if (other.userData?.isSliding) {
                debugLog("impact", "🛡️ Newtonian Victim-side Knockback!");

                // Reuse the snapshots — do NOT call other.translation()/linvel() again
                // (re-entering WASM mid-callback trips the aliasing guard).
                const attackerPos = victimSnap;
                const victimPos = attackerSnap;
                const attackerVel = attackerVelSnap;

                // Calculate Glancing Blow (Offset Vector) — guard zero-length.
                const gvx = victimPos.x - attackerPos.x;
                const gvz = victimPos.z - attackerPos.z;
                const gLen = Math.hypot(gvx, gvz);
                const glanceDir =
                    gLen > 1e-4 ? new THREE.Vector3(gvx / gLen, 0, gvz / gLen) : new THREE.Vector3(0, 0, 1);

                // Blend Attacker Velocity with Glancing Blow
                const aLen = Math.hypot(attackerVel.x, attackerVel.z);
                const velDir =
                    aLen > 1e-4 ? new THREE.Vector3(attackerVel.x / aLen, 0, attackerVel.z / aLen) : glanceDir.clone();

                const finalDir = new THREE.Vector3()
                .copy(velDir)
                .multiplyScalar(0.7) // 70% Forward
                .addScaledVector(glanceDir, 0.3); // 30% Outward (Glance)
                if (finalDir.lengthSq() < 1e-8) finalDir.copy(glanceDir);
                finalDir.normalize();

                // Scale force by player speed (min threshold so even slow hits move the can)
                const rawMult = other.userData?.slideMultiplier || 1;
                const slideMultiplier = Number.isFinite(rawMult) ? rawMult : 1;
                // Calculate speed from attacker's velocity since we're the victim
                const attackerSpeed = Math.hypot(attackerVel.x, attackerVel.z);
                const force = Number.isFinite(attackerSpeed) ? Math.max(attackerSpeed * 800 * slideMultiplier, 25) : 25;
                const safeForce = Math.min(force, 50000);
                // hit.ogg slide impact — volume 1, no force multiplier
                if (safeForce > 0) {
                    try {
                        soundManager.playPositional("hit", playerGroupRef.current, 1, 5, 1.0, 50, false);
                    } catch {}
                }
                debugLog(
                    "impact",
                    "🥫 Victim hit! attackerSpeed:",
                    attackerSpeed,
                    "multiplier:",
                    slideMultiplier,
                    "force:",
                    safeForce
                );

                try {
                    if ([finalDir.x, finalDir.z].every(Number.isFinite)) {
                        rigidBodyRef.current.applyImpulse(
                            {
                                x: finalDir.x * safeForce,
                                y: safeForce, // slight upward pop
                                z: finalDir.z * safeForce,
                            },
                            true
                        );
                    }
                } catch {}

                // Trigger screen-space ripple displacement for the victim
                triggerRipple();
            }
        } catch {
            /* collision callbacks must never crash the frame */
        }
    };

    return (
        <>
            <RigidBody
                ref={rigidBodyRef}
                position={[0, 110, 0]}
                colliders={false}
                lockRotations={true}
                mass={1}
                linearDamping={0.5}
                ccd={true} // Enable Continuous Collision for sliding
                collisionGroups={0x0002ffff}
                friction={0}
                frictionCombineRule={1}
                restitution={0}
                onCollisionEnter={handleCollision}
                userData={{
                    type: "player",
                    id: "local",
                    isSliding,
                    slideMultiplier:
                        powerUp?.category === "slide"
                            ? getPowerUpEffect("slide", powerUp.rarity, "blastPowerMultiplier")
                            : powerUp?.category === "speed"
                            ? getPowerUpEffect("speed", powerUp.rarity, "knockbackReduction")
                            : 1,
                }}>
                {/* UNIFIED COLLIDER (Hidden Debug) */}
                <CapsuleCollider
                    args={[1.5, 1]}
                    position={[0, 0, 0]}
                    friction={0}
                    frictionCombineRule={1}
                    restitution={0}>
                    {/* <mesh>
          <capsuleGeometry args={[1.5, 1]} />
          <meshStandardMaterial color="purple" transparent opacity={0.3} depthTest={false} />
        </mesh> */}
                </CapsuleCollider>

                <group ref={playerGroupRef} name="localPlayer" position={[0, isSliding ? -2.8 : -2.5, 0]}>
                    {isDashingVisual ? (
                        <PlayerModel
                            isMoving={true}
                            moveDir="for"
                            jumpPhase="none"
                            isSprinting={true}
                            isSliding={false}
                            hSpeed={0}
                            onFootstep={playFootstep}
                            config={animConfig}
                            jumpTransitionId={jumpTransitionId}
                        />
                    ) : (
                        <PlayerModel
                            isMoving={jumpPhase === "none" ? isMoving : true}
                            moveDir={jumpPhase === "none" ? moveDir : jumpLock.current.dir}
                            jumpPhase={jumpPhase}
                            isSprinting={jumpPhase === "none" ? !isWalking : jumpLock.current.sprint}
                            isSliding={isSliding}
                            hSpeed={hSpeedRef.current}
                            onFootstep={playFootstep}
                            config={animConfig}
                            jumpTransitionId={jumpTransitionId}
                        />
                    )}
                </group>
            </RigidBody>
            {/* Contact shadow — scene-level, follows character horizontally */}
            <ContactShadow characterRef={playerGroupRef} isLocalPlayer={true} />
        </>
    );
}
