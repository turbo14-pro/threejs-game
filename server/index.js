import geckos from '@geckos.io/server';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PLAYER_BASELINE } from '../src/config/playerConfig.js';

// --- PHYSICS SETUP ---
await RAPIER.init();
const gravity = { x: 0.0, y: -90.81, z: 0.0 }; // Match client-side feel
const world = new RAPIER.World(gravity);
world.timestep = 0.0333; // Match 30Hz TICK_RATE (33ms)

// 0. Cereal Box Constants & Helpers
const boxSize = { x: 30, y: 36, z: 12 };
const cerealBoxExtent = { x: 15, y: 18, z: 6 };

const getAdjustmentY = (extent, rotation) => {
  const { x: halfW, y: halfH, z: halfD } = extent;
  const corners = [
    new THREE.Vector3(-halfW, -halfH, -halfD),
    new THREE.Vector3(halfW, -halfH, -halfD),
    new THREE.Vector3(-halfW, halfH, -halfD),
    new THREE.Vector3(halfW, halfH, -halfD),
    new THREE.Vector3(-halfW, -halfH, halfD),
    new THREE.Vector3(halfW, -halfH, halfD),
    new THREE.Vector3(-halfW, halfH, halfD),
    new THREE.Vector3(halfW, halfH, halfD),
  ];
  const euler = new THREE.Euler(...rotation);
  const matrix = new THREE.Matrix4().makeRotationFromEuler(euler);
  let minY = Infinity;
  corners.forEach(p => {
    p.applyMatrix4(matrix);
    if (p.y < minY) minY = p.y;
  });
  return -minY + 0.01;
};

const seededRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

// 1. Main Table (Floor)
const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0);
const floorBody = world.createRigidBody(floorBodyDesc);
const floorColliderDesc = RAPIER.ColliderDesc.cuboid(300, 1, 300);
world.createCollider(floorColliderDesc, floorBody);

// 2. Platform 1 (Lobby)
const p1BodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 100, 0);
const p1Body = world.createRigidBody(p1BodyDesc);
const p1ColliderDesc = RAPIER.ColliderDesc.cuboid(35, 1, 15);
world.createCollider(p1ColliderDesc, p1Body);

// 3. Platform 2 (Weapons)
const p2BodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 100, -45);
const p2Body = world.createRigidBody(p2BodyDesc);
const p2ColliderDesc = RAPIER.ColliderDesc.cuboid(35, 1, 15);
world.createCollider(p2ColliderDesc, p2Body);

// 4. Bridge
const bridgeBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 100, -22.5);
const bridgeBody = world.createRigidBody(bridgeBodyDesc);
const bridgeColliderDesc = RAPIER.ColliderDesc.cuboid(7.5, 1, 10);
world.createCollider(bridgeColliderDesc, bridgeBody);

// 5. Cereal Box Obstacles (Procedural Sync)
const random = seededRandom(42);
const orientations = [
  [0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2]
];
const boxes = [];

for (let i = 0; i < 20; i++) {
  let valid = false;
  let x, z;
  let attempts = 0;
  while (!valid && attempts < 100) {
    x = (random() - 0.5) * 520;
    z = (random() - 0.5) * 520;
    attempts++;
    if (Math.abs(x) < 45 && z > -75 && z < 30) continue;
    let intersects = false;
    for (const b of boxes) {
      const dx = x - b.x;
      const dz = z - b.z;
      if (Math.sqrt(dx * dx + dz * dz) < 42) { intersects = true; break; }
    }
    if (!intersects) valid = true;
  }
  if (!valid) continue;

  const baseRot = orientations[Math.floor(random() * orientations.length)];
  const spin = Math.floor(random() * 4) * (Math.PI / 2);
  const finalRot = [baseRot[0], baseRot[1] + spin, baseRot[2]];
  const yOffset = getAdjustmentY(cerealBoxExtent, finalRot);

  boxes.push({ x, y: yOffset, z, rot: finalRot });

  // Create Physics Body for Box
  const boxBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(x, yOffset, z)
    .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(...finalRot)));
  const boxBody = world.createRigidBody(boxBodyDesc);

  // Add Multi-part Colliders (matching CerealBoxPhysics doorway logic)
  const w = boxSize.x, h = boxSize.y, d = boxSize.z;
  const thickness = 0.5;
  const t2 = thickness / 2;
  const doorHeight = 16;

  // Bottom
  world.createCollider(RAPIER.ColliderDesc.cuboid(w/2, t2, d/2).setTranslation(0, -h/2 + t2, 0), boxBody);
  // Sides
  world.createCollider(RAPIER.ColliderDesc.cuboid(t2, h/2, d/2).setTranslation(-w/2 + t2, 0, 0), boxBody);
  world.createCollider(RAPIER.ColliderDesc.cuboid(t2, h/2, d/2).setTranslation(w/2 - t2, 0, 0), boxBody);
  // Back
  world.createCollider(RAPIER.ColliderDesc.cuboid(w/2, h/2, t2).setTranslation(0, 0, -d/2 + t2), boxBody);
  // Front (with doorway)
  world.createCollider(RAPIER.ColliderDesc.cuboid(w/2, (h - doorHeight)/2, t2).setTranslation(0, h/2 - (h - doorHeight)/2, d/2 - t2), boxBody);
}

// --- PLAYER STATE ---
const players = new Map();
const channels = new Map();

const io = geckos({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  portRange: { min: 9208, max: 9218 }
});

io.onConnection(channel => {
  console.log(`[Server] Player connected: ${channel.id}`);
  
  // Create Physics Body for Player (Capsule)
  // Matching PlayerController.jsx: Capsule args [1.5, 1]
  // Matching PlayerController.jsx exactly
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

  channels.set(channel.id, channel);
  players.set(channel.id, { 
    id: channel.id, 
    body, 
    lastSeen: Date.now(),
    skin: 'avo',
    anim: {}
  });

  // Sync current state
  const currentPlayers = Array.from(players.values()).map(p => {
    const pos = p.body.translation();
    const rot = p.body.rotation();
    return {
      id: p.id,
      pos: [Number.isFinite(pos.x) ? pos.x : 0, Number.isFinite(pos.y) ? pos.y : 0, Number.isFinite(pos.z) ? pos.z : 0],
      rot: [Number.isFinite(rot.x) ? rot.x : 0, Number.isFinite(rot.y) ? rot.y : 0, Number.isFinite(rot.z) ? rot.z : 0, Number.isFinite(rot.w) ? rot.w : 1],
      skin: p.skin
    };
  });
  channel.emit('currentPlayers', currentPlayers);

  // --- HANDLERS ---
  
  // NEW: Input-Driven Authority (Phase 2)
  channel.on('input', (data) => {
    const p = players.get(channel.id);
    if (!p) return;
    p.lastSeen = Date.now();

    // Phase 01: Sequence number validation — reject duplicates and out-of-order inputs
    const sequenceId = data.sequenceId;
    if (sequenceId !== undefined) {
      if (p.lastProcessedSequenceId === undefined) p.lastProcessedSequenceId = -1;
      if (sequenceId <= p.lastProcessedSequenceId) {
        // Duplicate or out-of-order input — ignore to prevent double-processing
        return;
      }
      p.lastProcessedSequenceId = sequenceId;
    }

    // Buffer input by client tick for proper tick synchronization
    if (!p.inputBuffer) p.inputBuffer = new Map();
    p.inputBuffer.set(data.tick, {
      input: data.input,
      camRot: data.camRot,
      skin: data.skin || p.skin
    });
    
    // Keep buffer small (last 120 ticks = 4 seconds at 30Hz)
    if (p.inputBuffer.size > 120) {
      const oldestTick = Math.min(...p.inputBuffer.keys());
      p.inputBuffer.delete(oldestTick);
    }
    
    // Update current input for immediate use (fallback) — same shape as
    // buffered entries so inputData.input / inputData.camRot work either path
    p.input = { input: data.input, camRot: data.camRot, skin: data.skin || p.skin };
    p.tick = data.tick;
    p.skin = data.skin || p.skin;
  });

  // Keep 'pos' for legacy support during transition, but it will be ignored soon
  channel.on('pos', (data) => {
    const p = players.get(channel.id);
    if (!p) return;
    p.lastSeen = Date.now();
    p.skin = data.skin || p.skin;
    // Merge client anim with server anim - SERVER anim (jump/dash/slide) takes precedence
    // Client legacy pos may have stale jp state, so only merge non-authoritative fields
    if (data.anim) {
      const { jp, sl, ...clientAnim } = data.anim;
      p.anim = { ...p.anim, ...clientAnim };
      // Server-authoritative anim fields (jump/dash/slide) are NOT overwritten
    }
    
    // In Phase 2, we ONLY teleport if we don't have active inputs (e.g., initial join) or if forced
    if (data.pos && (!p.input || data.force)) {
      p.body.setTranslation({ x: data.pos[0], y: data.pos[1], z: data.pos[2] }, true);
      if (data.force) {
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  });

  channel.on('impact', (data) => {
    const p = players.get(channel.id);
    if (p) p.lastSeen = Date.now();
    io.emit('impact', { ...data, t: serverTick });
  });

  channel.on('ping', (t) => {
    const p = players.get(channel.id);
    if (p) p.lastSeen = Date.now();
    channel.emit('pong', t);
  });

  channel.onDisconnect(() => {
    console.log(`[Server] Player disconnected: ${channel.id}`);
    const p = players.get(channel.id);
    if (p) world.removeRigidBody(p.body);
    players.delete(channel.id);
    channels.delete(channel.id);
    io.emit('removePlayer', channel.id);
  });
});

// --- MAIN LOOP ---
let serverTick = 0;
const TICK_RATE = 33; // 30Hz

setInterval(() => {
  serverTick++;
  const now = Date.now();

  // 1. Process Inputs & Apply Forces
  for (const p of players.values()) {
    // Look up input for the current server tick from buffer.
    // Use the most recent input available (<= current tick) to handle
    // network latency — input sent for tick N+1 arrives at tick N+2.
    let bufferedInput = p.inputBuffer ? p.inputBuffer.get(serverTick) : null;
    if (!bufferedInput && p.inputBuffer) {
      // Find the most recent input <= current tick
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
    
    // Combine keyboard inputs
    const moveX = (d ? 1 : 0) - (a ? 1 : 0);
    const moveZ = (s ? 1 : 0) - (w ? 1 : 0);
    
    // Calculate target velocity — single source of truth from PLAYER_BASELINE
    const walkSpeed = PLAYER_BASELINE.movement.walkSpeed;
    const sprintSpeed = PLAYER_BASELINE.movement.sprintSpeed;
    const speed = walk ? walkSpeed : sprintSpeed;
    let vx = 0;
    let vz = 0;

    if (moveX !== 0 || moveZ !== 0) {
      // Normalize input vector
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const nx = moveX / length;
      const nz = moveZ / length;

      // Rotate by camera angle (match Client applyAxisAngle)
      const rot = camRot;
      vx = (nx * Math.cos(rot) + nz * Math.sin(rot)) * speed;
      vz = (-nx * Math.sin(rot) + nz * Math.cos(rot)) * speed;
    }

    const currentVel = p.body.linvel();
    const currentPos = p.body.translation();
    
    // Ground Check for Server - match client logic: y <= 5.5 (capsule half-height 1.5 + radius 1.5 + small margin)
    // Client capsule: height 3 (1.5*2), radius 1.5, so bottom at y - 1.5
    // Ground at y=0 (table) or y=100 (platforms)
    const isGrounded = currentPos.y <= 5.5 || (currentPos.y >= 99 && currentPos.y <= 105.5);

      // Apply Jump (Impulse matching client's jumpVelocity)
      if (jump && isGrounded && (!p.lastJumpTick || serverTick - p.lastJumpTick > 10)) {
        p.body.applyImpulse({ x: 0, y: PLAYER_BASELINE.movement.jumpVelocity, z: 0 }, true);
        p.lastJumpTick = serverTick;
        // Update anim state for remote players
        p.anim = { ...p.anim, jp: 'launch' };
      }

      // Dash: Simulate with BASELINE speed - no power-ups on server
      // Detect rising edge like client does
      const dashPressed = dash && !p.prevDashInput;
      p.prevDashInput = dash;
      
      if (dashPressed && isGrounded && (!p.lastDashTick || serverTick - p.lastDashTick > 20)) {
        // Baseline dash speed from PLAYER_BASELINE
        const dashSpeed = PLAYER_BASELINE.dash.dashSpeed;
        const rot = camRot;
        const dashVx = Math.sin(rot) * dashSpeed;
        const dashVz = Math.cos(rot) * dashSpeed;
        // Use setLinvel like client does for dash
        const currentVel = p.body.linvel();
        p.body.setLinvel({ x: dashVx, y: currentVel.y, z: dashVz }, true);
        p.lastDashTick = serverTick;
        // Update anim state for remote players
        p.anim = { ...p.anim, jp: 'dash' };
      }

      // Apply Slide (match client's slide speed from PLAYER_BASELINE)
      if (slide && isGrounded) {
        const slideSpeed = PLAYER_BASELINE.movement.slideSpeed;
        const rot = camRot;
        const slideVx = Math.sin(rot) * slideSpeed;
        const slideVz = Math.cos(rot) * slideSpeed;
        // Slide overrides normal movement
        vx = slideVx;
        vz = slideVz;
        // Update anim state for remote players
        p.anim = { ...p.anim, sl: true };
      } else if (!slide) {
        // Clear slide anim when not sliding
        if (p.anim?.sl) {
          p.anim = { ...p.anim, sl: false };
        }
      }

      p.body.setLinvel({ x: vx, y: currentVel.y, z: vz }, true);
      
      // Broadcast the tick that was actually processed (the input tick),
      // NOT an incremented value. The client matches history entries by this tick.
      // Do NOT increment p.tick here — that causes reconciliation to look up
      // a history entry that was never recorded.
  }

  // 2. Step Physics
  world.step();

  // 2. Check for Timeouts
  for (const [id, player] of players.entries()) {
    if (now - player.lastSeen > 60000) {
      console.log(`[Server] Player ${id} timed out`);
      io.emit('removePlayer', id);
      world.removeRigidBody(player.body);
      players.delete(id);
      const ch = channels.get(id);
      if (ch) ch.close();
      channels.delete(id);
    }
  }

  // 3. Broadcast Snapshot
  const playerList = Array.from(players.values()).map(p => {
    const pos = p.body.translation();
    const vel = p.body.linvel();

    // Sanitize non-finite physics state so NaN/Infinity never reaches clients
    // (which would crash PositionalAudio panners via updateMatrixWorld).
    const px = Number.isFinite(pos.x) ? pos.x : 0;
    const py = Number.isFinite(pos.y) ? pos.y : 0;
    const pz = Number.isFinite(pos.z) ? pos.z : 0;
    const vx = Number.isFinite(vel.x) ? vel.x : 0;
    const vy = Number.isFinite(vel.y) ? vel.y : 0;
    const vz = Number.isFinite(vel.z) ? vel.z : 0;

    return {
      id: p.id,
      pos: [px, py, pz],
      vel: [vx, vy, vz],
      rot: Number.isFinite(p.rot) ? p.rot : 0,
      skin: p.skin,
      anim: p.anim,
      tick: p.tick // THE CLIENT TICK WE JUST PROCESSED
    };
  });

  if (playerList.length > 0) {
    const payload = { p: playerList, t: serverTick };
    const payloadSize = JSON.stringify(payload).length;
    
    // Log tick drift and payload size for baseline measurement
    const avgClientTick = playerList.reduce((sum, p) => sum + (p.tick || 0), 0) / playerList.length;
    const tickDrift = serverTick - avgClientTick;
    
    if (serverTick % 60 === 0) { // Log every 2 seconds at 30Hz
      console.log(`[Server] Tick: ${serverTick}, Players: ${playerList.length}, Drift: ${tickDrift.toFixed(1)}, Payload: ${payloadSize}B`);
    }
    
    io.emit('update', payload);
  }
}, TICK_RATE);

io.listen(9208, '0.0.0.0');
console.log('[Server] Authoritative Physics Brain is listening on port 9208');

