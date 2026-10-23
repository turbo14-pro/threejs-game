/**
 * Physics Worker — runs Rapier physics simulation at 60Hz in a separate thread.
 * Communicates with main thread via postMessage.
 *
 * Input from main thread: { type: 'input', playerId, input, camRot, tick }
 * Output to main thread: { type: 'snapshot', players: [...], serverTick }
 */
const { parentPort, workerData } = require('worker_threads');
const RAPIER = require('@dimforge/rapier3d-compat');
const { debugLog } = require('../src/utils/debugLog.js');

// Initialize Rapier (synchronous in worker)
await RAPIER.init();

// Physics constants
const gravity = { x: 0.0, y: -90.81, z: 0.0 };
const world = new RAPIER.World(gravity);
world.timestep = 1 / 60; // 60Hz simulation

// Shared config (imported from main thread via workerData)
const { PLAYER_BASELINE } = workerData;

// Import shared physics functions
const { computeVelocity, isGrounded, getJumpVelocity, getDashSpeed, getSlideSpeed, getSpeed } = require('../src/utils/baseGame.js');

// --- PLAYER STATE ---
const players = new Map(); // playerId -> { body, inputBuffer, lastProcessedSequenceId, ... }

// --- INPUT HANDLING ---
parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'addPlayer': {
      const { playerId } = msg;
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 110, 0)
        .setLinearDamping(0.5)
        .setAdditionalMass(1.0)
        .lockRotations();
      const body = world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.capsule(1.5, 1)
        .setFriction(0)
        .setRestitution(0);
      world.createCollider(colliderDesc, body);
      players.set(playerId, {
        body,
        inputBuffer: new Map(),
        lastProcessedSequenceId: -1,
        lastJumpTick: -1,
        prevJump: false,
        prevDashInput: false,
        jumpPhase: 'none',
        jumpPhaseTick: 0,
        dashPhase: 'none',
        dashPhaseTick: 0,
        camRot: 0,
        skin: 'avo',
        anim: {},
        jumpCount: 0, // Track jump count for double jump support
      });
      break;
    }

    case 'teleport': {
      const { playerId, pos, force } = msg;
      const p = players.get(playerId);
      if (!p) break;
      const body = p.body;
      body.setTranslation({ x: pos[0], y: pos[1], z: pos[2] }, true);
      if (force) {
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      break;
    }

    case 'removePlayer': {
      const { playerId } = msg;
      const p = players.get(playerId);
      if (p) {
        world.removeRigidBody(p.body);
        players.delete(playerId);
      }
      break;
    }

    case 'input': {
      const { playerId, input, camRot, tick, sequenceId } = msg;
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
      p.inputBuffer.set(tick, { input, camRot, skin: msg.skin || p.skin });
      if (p.inputBuffer.size > 120) {
        const oldestTick = Math.min(...p.inputBuffer.keys());
        p.inputBuffer.delete(oldestTick);
      }

      // Update current input (fallback)
      p.input = { input, camRot, skin: msg.skin || p.skin };
      p.tick = tick;
      p.skin = msg.skin || p.skin;
      p.camRot = camRot || 0;
      break;
    }
  }
});

// --- PHYSICS SIMULATION LOOP (60Hz) ---
let serverTick = 0;
const SIMULATION_RATE = 1000 / 60; // 60Hz

function simulate() {
  serverTick++;
  const now = Date.now();

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
    if (!inputData) continue;

    const { w, a, s, d, jump, walk, dash, slide } = inputData.input;
    const camRot = inputData.camRot || p.camRot || 0;

    // Calculate target velocity via shared BaseGame
    const speed = getSpeed(walk);
    let { vx, vz } = computeVelocity({ w, a, s, d }, camRot, speed);

    const currentVel = p.body.linvel();
    const currentPos = p.body.translation();

    // Ground Check for Server via shared BaseGame
    const playerIsGrounded = isGrounded(currentPos);

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
    const maxJumps = PLAYER_BASELINE.movement.maxJumps || 2;
    const canJump = p.jumpRequested && (!p.lastJumpTick || serverTick - p.lastJumpTick > 10) && (
      playerIsGrounded || p.jumpCount < maxJumps
    );

    if (canJump) {
      p.body.setLinvel({ x: currentVel.x, y: getJumpVelocity(), z: currentVel.z }, true);
      p.lastJumpTick = serverTick;
      p.jumpRequested = false; // Consume the request
      p.jumpPhase = 'launch';
      p.jumpPhaseTick = serverTick;
      // Update anim state for remote players
      p.anim = { ...p.anim, jp: 'launch' };
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
      debugLog(`[SERVER JUMP] player=${p.id} jumpRequested=true but max jumps reached (${p.jumpCount}/${maxJumps})`);
    } else if (p.jumpRequested && !playerIsGrounded) {
      debugLog(`[SERVER JUMP] player=${p.id} jumpRequested=true but NOT grounded, skipping`);
    } else if (p.jumpRequested && p.lastJumpTick && serverTick - p.lastJumpTick <= 10) {
      debugLog(`[SERVER JUMP] player=${p.id} jumpRequested=true but cooldown active (${serverTick - p.lastJumpTick} ticks since last)`);
    }

    // Reset jump count when grounded
    if (playerIsGrounded && p.jumpPhase === 'none') {
      p.jumpCount = 0;
    }

    // Track jump phase for remote animation sync
    const JUMP_LAUNCH_TICKS = 2;
    const JUMP_LAND_TICKS = 2;

    if (p.jumpPhase === 'launch') {
      if (serverTick - p.jumpPhaseTick >= JUMP_LAUNCH_TICKS) {
        if (!playerIsGrounded) {
          p.jumpPhase = 'air';
          p.jumpPhaseTick = serverTick;
          p.anim = { ...p.anim, jp: 'air' };
        }
      }
    } else if (p.jumpPhase === 'air' && playerIsGrounded) {
      p.jumpPhase = 'land';
      p.jumpPhaseTick = serverTick;
      p.anim = { ...p.anim, jp: 'land' };
    } else if (p.jumpPhase === 'land') {
      if (serverTick - p.jumpPhaseTick >= JUMP_LAND_TICKS) {
        p.jumpPhase = 'none';
        p.anim = { ...p.anim, jp: 'none' };
      }
    }

    // Dash
    const dashPressed = dash && !p.prevDashInput;
    p.prevDashInput = dash;

    if (dashPressed && playerIsGrounded && (!p.lastDashTick || serverTick - p.lastDashTick > 20)) {
      const dashSpeed = getDashSpeed();
      const rot = camRot;
      const dashVx = Math.sin(rot) * dashSpeed;
      const dashVz = Math.cos(rot) * dashSpeed;
      const currentVel2 = p.body.linvel();
      p.body.setLinvel({ x: dashVx, y: currentVel2.y, z: dashVz }, true);
      p.lastDashTick = serverTick;
      p.dashPhase = 'dash';
      p.dashPhaseTick = serverTick;
      p.anim = { ...p.anim, jp: 'dash' };
    }

    if (p.dashPhase === 'dash' && serverTick - p.dashPhaseTick >= 2) {
      p.dashPhase = 'none';
      p.anim = { ...p.anim, jp: 'none' };
    }

    // Apply Slide
    if (slide && playerIsGrounded) {
      const slideSpeed = getSlideSpeed();
      const rot = camRot;
      const slideVx = Math.sin(rot) * slideSpeed;
      const slideVz = Math.cos(rot) * slideSpeed;
      vx = slideVx;
      vz = slideVz;
      p.anim = { ...p.anim, sl: true };
    } else if (!slide) {
      if (p.anim?.sl) {
        p.anim = { ...p.anim, sl: false };
      }
    }

    p.body.setLinvel({ x: vx, y: currentVel.y, z: vz }, true);
  }

  // 2. Step Physics
  world.step();

  // 3. Build snapshot
  const playerList = [];
  for (const p of players.values()) {
    const pos = p.body.translation();
    const vel = p.body.linvel();
    const rot = p.body.rotation();

    playerList.push({
      id: p.id,
      pos: [Number.isFinite(pos.x) ? pos.x : 0, Number.isFinite(pos.y) ? pos.y : 0, Number.isFinite(pos.z) ? pos.z : 0],
      vel: [Number.isFinite(vel.x) ? vel.x : 0, Number.isFinite(vel.y) ? vel.y : 0, Number.isFinite(vel.z) ? vel.z : 0],
      rot: [Number.isFinite(rot.x) ? rot.x : 0, Number.isFinite(rot.y) ? rot.y : 0, Number.isFinite(rot.z) ? rot.z : 0, Number.isFinite(rot.w) ? rot.w : 1],
      skin: p.skin,
      anim: p.anim,
      tick: p.tick,
      lastProcessedSeq: p.lastProcessedSequenceId,
    });
  }

  // Send snapshot to main thread
  parentPort.postMessage({
    type: 'snapshot',
    players: playerList,
    serverTick,
  });
}

// Start simulation loop
setInterval(simulate, SIMULATION_RATE);
