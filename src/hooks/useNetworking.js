import { useEffect, useRef } from 'react';
import geckos from '@geckos.io/client';
import { useGameStore } from '../store/useGameStore';

/**
 * THE MULTIPLAYER HOOK
 * Handles the connection and syncing with the Geckos server.
 */
export function useNetworking() {
  const channelRef = useRef(null);
  const gameState = useGameStore(state => state.game.state);
  const updateRemotePlayers = useGameStore(state => state.updateRemotePlayers);
  const removeRemotePlayer = useGameStore(state => state.removeRemotePlayer);
  const setNetworkId = useGameStore(state => state.setNetworkId);

  useEffect(() => {
    // Only connect when we are in the game
    if (gameState === 'MENU') {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
      return;
    }

    // 2. Determine which server to talk to
    const isDev = import.meta.env.DEV;
    const rawUrl = isDev 
      ? import.meta.env.VITE_SERVER_URL_LOCAL 
      : import.meta.env.VITE_SERVER_URL_PRODUCTION;

    // BULLETPROOF CLEANING: Strip 'http://' and any extra ports
    const cleanHost = rawUrl.replace('http://', '').split(':')[0];
    const cleanPort = 9208;

    console.log(`[Network] Connecting to ${isDev ? 'LOCAL' : 'REMOTE'} -> ${cleanHost}:${cleanPort}`);

    // Connect using host and port separately (safest way)
    const channel = geckos({ host: cleanHost, port: cleanPort });
    channelRef.current = channel;

    channel.onConnect(error => {
      if (error) {
        console.warn('[Network] Connection failed:', error.message);
        return;
      }

      console.log('[Network] Connected to server! ID:', channel.id);
      setNetworkId(channel.id);

      // Handle the initial list of players
      channel.on('currentPlayers', (players) => {
        updateRemotePlayers(players);
      });

      // Handle the regular updates (20 times per second)
      channel.on('update', (players) => {
        updateRemotePlayers(players);
      });

      // Handle a player leaving
      channel.on('removePlayer', (id) => {
        removeRemotePlayer(id);
      });
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
  }, [gameState, updateRemotePlayers, removeRemotePlayer, setNetworkId]);

  // Function to send our current position and animation state
  const sendUpdate = (data) => {
    if (channelRef.current) {
      // data: { pos: [x,y,z], rot, skin, anim }
      channelRef.current.emit('pos', data);
    }
  };

  return { sendUpdate };
}
