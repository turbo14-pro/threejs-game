import geckos from '@geckos.io/server';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLAYER_BASELINE } from '../src/utils/baseGame.js';
import { debugLog } from '../src/utils/debugLog.js';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- PHYSICS WORKER (runs in separate thread at 30Hz) ---
const worker = new Worker(path.join(__dirname, 'physics-worker.mjs'), {
  workerData: { PLAYER_BASELINE },
});

// --- PLAYER STATE (client connection state only, no physics) ---
const players = new Map(); // channel.id -> { id, bodyId, skin, anim, lastSeen, ... }
const channels = new Map(); // channel.id -> channel

// --- BOT STATE ---
const bots = new Map(); // botId -> { id, bodyId, skin, anim, lastSeen, targetId, lastDecisionTick }
const BOT_COUNT = 3;
const BOT_UPDATE_INTERVAL = 3; // ticks between bot AI decisions

const io = geckos({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  portRange: { min: 9208, max: 9218 }
});

// --- WORKER MESSAGE HANDLER ---
worker.on('message', (msg) => {
  switch (msg.type) {
    case 'snapshot': {
      const { players: playerList, serverTick } = msg;
      const payload = { p: playerList, t: serverTick };

      debugLog(`[SERVER] Received snapshot: ${playerList.length} players, tick=${serverTick}, channels=${channels.size}`);

      for (const [viewerId, viewerChannel] of channels) {
        // Filter out the viewer from their own player list
        const filtered = playerList.filter(p => p.id !== viewerId);
        if (filtered.length > 0) {
          viewerChannel.emit('update', { p: filtered, t: serverTick });
          debugLog(`[SERVER] Sent update to viewer=${viewerId}: ${filtered.length} players`);
        } else {
          debugLog(`[SERVER] No other players for viewer=${viewerId}`);
        }
      }
      break;
    }
    default:
      debugLog(`[SERVER] Unknown worker message type: ${msg.type}`);
  }
});

worker.on('error', (err) => {
  debugLog(`[SERVER] Worker error: ${err.message}`);
});

worker.on('exit', (code) => {
  debugLog(`[SERVER] Worker exited with code ${code}`);
});

// --- CONNECTION HANDLERS ---

io.onConnection(channel => {
  console.log(`[Server] Player connected: ${channel.id}`);

  // Tell worker to create a physics body for this player
  worker.postMessage({
    type: 'addPlayer',
    playerId: channel.id,
  });

  channels.set(channel.id, channel);
  players.set(channel.id, {
    id: channel.id,
    bodyId: channel.id,
    lastSeen: Date.now(),
    skin: 'avo',
    anim: {},
    camRot: 0,
    lastStateHash: new Map(), // Phase 05: per-viewer change detection hash
    jumpPhase: 'none',
    jumpPhaseTick: 0,
    dashPhase: 'none',
    dashPhaseTick: 0,
    jumpRequested: false,
    prevJump: false,
    prevDashInput: false,
    lastJumpTick: -1,
    lastDashTick: -1,
  });

  // Send current state to new player (will be populated on next worker tick)
  channel.emit('currentPlayers', []);

  // --- INPUT HANDLER ---
  channel.on('input', (data) => {
    const p = players.get(channel.id);
    if (!p) return;
    p.lastSeen = Date.now();

    // Phase 01: Sequence number validation
    const sequenceId = data.sequenceId;
    if (sequenceId !== undefined) {
      if (p.lastProcessedSequenceId === undefined) p.lastProcessedSequenceId = -1;
      if (sequenceId <= p.lastProcessedSequenceId) {
        return; // Duplicate or out-of-order
      }
      p.lastProcessedSequenceId = sequenceId;
    }

    // Forward input to worker
    worker.postMessage({
      type: 'input',
      playerId: channel.id,
      input: data.input,
      camRot: data.camRot,
      tick: data.tick,
      sequenceId,
      skin: data.skin || p.skin,
    });

    // Update local state
    p.input = { input: data.input, camRot: data.camRot, skin: data.skin || p.skin };
    p.tick = data.tick;
    p.skin = data.skin || p.skin;
    p.camRot = data.camRot || 0;
  });

  // --- POSITION HANDLER (legacy) ---
  channel.on('pos', (data) => {
    const p = players.get(channel.id);
    if (!p) return;
    p.lastSeen = Date.now();
    p.skin = data.skin || p.skin;

    // Merge client anim with server anim - SERVER anim takes precedence
    if (data.anim) {
      const { jp, sl, ...clientAnim } = data.anim;
      p.anim = { ...p.anim, ...clientAnim };
    }

    // Forward position to worker for teleport (initial join or forced)
    if (data.pos && (!p.input || data.force)) {
      worker.postMessage({
        type: 'teleport',
        playerId: channel.id,
        pos: data.pos,
        force: data.force,
      });
    }
  });

  // --- IMPACT HANDLER ---
  channel.on('impact', (data) => {
    const p = players.get(channel.id);
    if (p) p.lastSeen = Date.now();
    io.emit('impact', { ...data, t: Date.now() });
  });

  // --- PING HANDLER ---
  channel.on('ping', (t) => {
    const p = players.get(channel.id);
    if (p) p.lastSeen = Date.now();
    channel.emit('pong', t);
  });

  // --- DISCONNECT HANDLER ---
  channel.onDisconnect(() => {
    console.log(`[Server] Player disconnected: ${channel.id}`);
    const p = players.get(channel.id);
    if (p) {
      worker.postMessage({ type: 'removePlayer', playerId: channel.id });
      players.delete(channel.id);
    }
    channels.delete(channel.id);
    io.emit('removePlayer', channel.id);
  });
});

io.listen(9208, '0.0.0.0');
console.log('[Server] Authoritative Physics Brain is listening on port 9208');

// --- OBSTACLE STATE (cereal boxes from seed(42), matching Arena.jsx) ---
const seededRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const random = seededRandom(42);
const orientations = [
  [0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2]
];
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

const obstacles = [];
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
    for (const b of obstacles) {
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

  obstacles.push({ x, y: yOffset, z, rot: finalRot, w: boxSize.x, h: boxSize.y, d: boxSize.z });
}

// Send obstacles to physics worker for ground check and broadcast
worker.postMessage({
  type: 'setObstacles',
  obstacles,
});

console.log(`[Server] ${obstacles.length} obstacles created and sent to worker`);

// --- BOT INITIALIZATION ---
// Create server-controlled bots that are broadcast to all clients (Issue 5)
for (let i = 0; i < BOT_COUNT; i++) {
  const botId = `bot-${i}`;
  worker.postMessage({
    type: 'addBot',
    playerId: botId,
  });
  bots.set(botId, {
    id: botId,
    bodyId: botId,
    lastSeen: Date.now(),
    skin: 'avo',
    anim: {},
    camRot: 0,
    targetId: null,
    lastDecisionTick: 0,
  });
  console.log(`[Server] Bot created: ${botId}`);
}

// --- BOT AI LOOP (runs on server tick, deterministic) ---
let botTick = 0;
setInterval(() => {
  botTick++;
  if (botTick % BOT_UPDATE_INTERVAL !== 0) return;

  const playerList = Array.from(players.values());
  if (playerList.length === 0) return;

  for (const [botId, bot] of bots) {
    // Simple heuristic: move towards nearest player
    const botPos = { x: 0, y: 110, z: 0 }; // Default, would need worker position
    let nearestPlayer = null;
    let nearestDist = Infinity;

    for (const p of playerList) {
      // Approximate distance using last known positions
      // In a full implementation, we'd query the worker for bot position
      const dist = 50; // Placeholder
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPlayer = p;
      }
    }

    if (nearestPlayer) {
      bot.targetId = nearestPlayer.id;
      bot.lastDecisionTick = botTick;

      // Send bot input to worker
      worker.postMessage({
        type: 'input',
        playerId: botId,
        input: { w: true, a: false, s: false, d: false, jump: false, walk: false, dash: false, slide: false },
        camRot: 0,
        tick: botTick,
        skin: bot.skin,
      });
    }
  }
}, 100); // Bot AI runs at 10Hz
