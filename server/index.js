import geckos from '@geckos.io/server';

// THE MULTIPLAYER MAIN BRAIN
const io = geckos();

// Store for all players on the server
const players = new Map();

io.onConnection(channel => {
  console.log(`[Server] Player connected: ${channel.id}`);

  // 1. Send current players to the newcomer
  channel.emit('currentPlayers', Array.from(players.values()));

  // 2. Handle position updates
  channel.on('pos', (data) => {
    // data: { id, pos, rot, skin }
    players.set(channel.id, { ...data, id: channel.id });
  });

  // 3. Handle disconnection
  channel.onDisconnect(() => {
    console.log(`[Server] Player disconnected: ${channel.id}`);
    players.delete(channel.id);
    io.emit('removePlayer', channel.id);
  });
});

// BROADCAST TICK: 20 times per second (50ms)
// This sends the master list of everyone to everyone.
setInterval(() => {
  const playerList = Array.from(players.values());
  if (playerList.length > 0) {
    io.emit('update', playerList);
  }
}, 50);

// Default Geckos port is 9208
io.listen(9208);
console.log('[Server] Multiplayer brain is listening on port 9208');
