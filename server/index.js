import geckos from '@geckos.io/server';

// THE MULTIPLAYER MAIN BRAIN
const io = geckos({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  // RADICAL FIX: We force the server to only use port 9208
  portRange: { min: 9208, max: 9208 }
});

// THE LIST OF PLAYERS AND THEIR CONNECTIONS
const players = new Map();
const channels = new Map();

// How long to wait before removing an inactive player (1 minute)
const TIMEOUT_MS = 60000;

// Global server tick counter
let serverTick = 0;

io.onConnection(channel => {
  console.log(`[Server] Player connected: ${channel.id}`);
  
  // Store the connection and start tracking activity
  channels.set(channel.id, channel);
  players.set(channel.id, { id: channel.id, lastSeen: Date.now() });

  // 1. Send current players to the newcomer
  channel.emit('currentPlayers', Array.from(players.values()));

  // 2. Handle position updates
  channel.on('pos', (data) => {
    // data: { id, pos, rot, skin, tick }
    const existing = players.get(channel.id) || {};
    players.set(channel.id, { 
      ...existing, 
      ...data, 
      id: channel.id, 
      lastSeen: Date.now() 
    });
  });

  // 3. Relay impact events to everyone with a server timestamp
  channel.on('impact', (data) => {
    // Update activity on impact too
    const existing = players.get(channel.id);
    if (existing) existing.lastSeen = Date.now();
    
    io.emit('impact', { ...data, t: serverTick });
  });

  // 4. Latency Ping-Pong
  channel.on('ping', (t) => {
    // Update activity on ping
    const existing = players.get(channel.id);
    if (existing) existing.lastSeen = Date.now();
    
    channel.emit('pong', t);
  });

  // 5. Handle disconnection
  channel.onDisconnect(() => {
    console.log(`[Server] Player disconnected: ${channel.id}`);
    players.delete(channel.id);
    channels.delete(channel.id);
    io.emit('removePlayer', channel.id);
  });
});

// BROADCAST TICK: 30 times per second
setInterval(() => {
  serverTick++;
  const now = Date.now();

  // CHECK FOR TIMEOUTS
  for (const [id, player] of players.entries()) {
    if (now - player.lastSeen > TIMEOUT_MS) {
      console.log(`[Server] Player ${id} timed out (inactive for ${TIMEOUT_MS}ms)`);
      
      // Notify others
      io.emit('removePlayer', id);
      
      // Cleanup data
      players.delete(id);
      
      // Close the connection
      const channel = channels.get(id);
      if (channel) {
        channel.close();
        channels.delete(id);
      }
    }
  }

  const playerList = Array.from(players.values());
  if (playerList.length > 0) {
    io.emit('update', { 
      p: playerList, 
      t: serverTick 
    });
  }
}, 33); // 30Hz

// Default Geckos port is 9208
// We bind to 0.0.0.0 to allow all incoming traffic
io.listen(9208, '0.0.0.0');
console.log('[Server] Multiplayer brain is listening on port 9208');
