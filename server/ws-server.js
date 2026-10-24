/**
 * WS Binary Server — Phase B: WebSocket Binary Migration
 * Replaces Geckos.io WebRTC teleport-sync with WS binary AUTH+PRED+INTERP.
 * Runs physics in worker_thread at 30Hz, broadcasts snapshots at 20Hz.
 *
 * Protocol: ws + msgpackr binary encoding
 * Port: 9208 (WSS via Nginx on 443 in production)
 */
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { encode, decode } from 'msgpackr';
import * as THREE from 'three';
import { PLAYER_BASELINE } from '../src/utils/baseGame.js';
import { debugLog } from '../src/utils/debugLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- PHYSICS WORKER (30Hz) ---
const worker = new Worker(path.join(__dirname, 'physics-worker.mjs'), {
  workerData: { PLAYER_BASELINE },
});

// --- WEBSOCKET SERVER ---
const wss = new WebSocketServer({ port: 9208 });
const clients = new Map(); // ws -> { id, playerId, lastSeen, sequenceTracker }
let nextClientId = 0;

// --- WORKER MESSAGE HANDLER ---
worker.on('message', (msg) => {
  switch (msg.type) {
    case 'snapshot': {
      const { players: playerList, serverTick } = msg;

      for (const [ws, client] of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          // Filter out the viewer from their own player list
          const filtered = playerList.filter(p => p.id !== client.playerId);
          if (filtered.length > 0) {
            const viewerPayload = { p: filtered, t: serverTick };
            ws.send(encode(viewerPayload), { binary: true });
          }
        }
      }
      break;
    }
    default:
      debugLog(`[WS SERVER] Unknown worker message type: ${msg.type}`);
  }
});

worker.on('error', (err) => {
  debugLog(`[WS SERVER] Worker error: ${err.message}`);
});

worker.on('exit', (code) => {
  debugLog(`[WS SERVER] Worker exited with code ${code}`);
});

// --- CLIENT CONNECTION HANDLER ---
wss.on('connection', (ws) => {
  const clientId = nextClientId++;
  const playerId = `ws-${clientId}`;
  clients.set(ws, {
    id: clientId,
    playerId,
    lastSeen: Date.now(),
    sequenceTracker: 0,
  });

  debugLog(`[WS SERVER] Client connected: ${playerId}`);

  // Send welcome message with playerId so client can tag inputs
  ws.send(encode({ type: 'welcome', playerId }), { binary: true });

  // Tell worker to create a physics body for this player
  worker.postMessage({
    type: 'addPlayer',
    playerId,
  });

  ws.on('message', (data) => {
    const client = clients.get(ws);
    if (!client) return;
    client.lastSeen = Date.now();

    try {
      const msg = decode(new Uint8Array(data));

      switch (msg.type) {
        case 'input': {
          // Sequence number validation
          const sequenceId = msg.sequenceId !== undefined ? msg.sequenceId : client.sequenceTracker++;
          if (sequenceId <= client.sequenceTracker) {
            return; // Duplicate or out-of-order
          }
          client.sequenceTracker = sequenceId;

          // Forward input to worker
          worker.postMessage({
            type: 'input',
            playerId,
            input: msg.input,
            camRot: msg.camRot,
            tick: msg.tick,
            sequenceId,
            skin: msg.skin || 'avo',
          });
          break;
        }

        case 'pos': {
          // Legacy position handler (teleport)
          if (msg.pos && msg.force) {
            worker.postMessage({
              type: 'teleport',
              playerId,
              pos: msg.pos,
              force: true,
            });
          }
          break;
        }

        case 'ping': {
          ws.send(encode({ type: 'pong', t: msg.t }), { binary: true });
          break;
        }
      }
    } catch (e) {
      debugLog(`[WS SERVER] Message parse error: ${e.message}`);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      worker.postMessage({ type: 'removePlayer', playerId });
      clients.delete(ws);
    }
    debugLog(`[WS SERVER] Client disconnected: ${playerId}`);
  });

  ws.on('error', (err) => {
    debugLog(`[WS SERVER] Client error: ${err.message}`);
  });
});

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

debugLog(`[WS SERVER] ${obstacles.length} obstacles created and sent to worker`);

// --- BOT STATE ---
const bots = new Map();
const BOT_COUNT = 3;
const BOT_UPDATE_INTERVAL = 3;

// --- BOT INITIALIZATION ---
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
  debugLog(`[WS SERVER] Bot created: ${botId}`);
}

// --- BOT AI LOOP (10Hz) ---
let botTick = 0;
setInterval(() => {
  botTick++;
  if (botTick % BOT_UPDATE_INTERVAL !== 0) return;

  // Simple heuristic: bots move forward
  for (const [botId] of bots) {
    worker.postMessage({
      type: 'input',
      playerId: botId,
      input: { w: true, a: false, s: false, d: false, jump: false, walk: false, dash: false, slide: false },
      camRot: 0,
      tick: botTick,
      skin: 'avo',
    });
  }
}, 100);

wss.on('listening', () => {
  debugLog('[WS SERVER] WebSocket binary server listening on port 9208');
});

console.log('[WS Server] WebSocket Binary Auth Server is listening on port 9208');