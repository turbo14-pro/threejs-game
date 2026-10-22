import geckos from '@geckos.io/server';
import { Worker } from 'worker_threads';
import path from 'path';
import { PLAYER_BASELINE } from '../src/utils/baseGame.js';
import { debugLog } from '../src/utils/debugLog.js';

// --- PHYSICS WORKER (runs in separate thread at 60Hz) ---
const worker = new Worker(path.join(__dirname, 'physics-worker.js'), {
  workerData: { PLAYER_BASELINE },
});

// --- PLAYER STATE (client connection state only, no physics) ---
const players = new Map(); // channel.id -> { id, bodyId, skin, anim, lastSeen, ... }
const channels = new Map(); // channel.id -> channel

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

      for (const [viewerId, viewerChannel] of channels) {
        // Filter out the viewer from their own player list
        const filtered = playerList.filter(p => p.id !== viewerId);
        if (filtered.length > 0) {
          viewerChannel.emit('update', { p: filtered, t: serverTick });
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
