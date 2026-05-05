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
  const setNetworkStatus = useGameStore(state => state.setNetworkStatus);
  const triggerKnockback = useGameStore(state => state.triggerKnockback);
  const addShockwave = useGameStore(state => state.addShockwave);

  useEffect(() => {
    // Only connect when we are in the game
    if (gameState === 'MENU') {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
        setNetworkStatus('OFFLINE');
      }
      return;
    }

    // --- DEBUG TRACE: START ---
    const isDev = import.meta.env.DEV;
    // In dev mode use the local server; in production use the cloud server
    const rawEnvUrl = isDev
      ? import.meta.env.VITE_SERVER_URL_LOCAL
      : import.meta.env.VITE_SERVER_URL_PRODUCTION;
    
    console.log('%c 📡 [Network Trace] Starting Connection Sequence...', 'color: #00ff88; font-weight: bold;');
    console.log('   > Mode:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');
    console.log('   > Raw Env URL:', rawEnvUrl);

    // CLEANING THE URL: Remove any trailing ports or slashes
    const baseAddress = rawEnvUrl.replace(':9208', '').replace(/\/$/, '');
    
    // In dev we hit the raw port 9208. In prod, Nginx handles SSL on port 443.
    const targetPort = isDev ? 9208 : 443;
    
    console.log('   > Base Address:', baseAddress);
    console.log('   > Target Port:', targetPort);

    // Tell the UI we are looking for the server
    setNetworkStatus('CONNECTING');

    // 2. Connect to the server
    // We add a "STUN" server (from Google) to help the game find the path through the cloud firewalls.
    const channel = geckos({ 
      url: baseAddress, 
      port: targetPort,
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    channelRef.current = channel;

    console.log('   > Geckos Instance Created with STUN. Waiting for handshake...');

    channel.onConnect(error => {
      if (error) {
        console.error('%c ❌ [Network Trace] Handshake Failed!', 'color: #ff4444; font-weight: bold;');
        console.error('   > Error Message:', error.message);
        console.error('   > Check if the browser is blocking HTTP to an IP address (Mixed Content).');
        setNetworkStatus('ERROR');
        return;
      }

      console.log('%c ✅ [Network Trace] Handshake Success!', 'color: #00ff88; font-weight: bold;');
      console.log('   > Connection ID:', channel.id);
      setNetworkId(channel.id);
      setNetworkStatus('ONLINE');

      // 1. Tell the server who we are and what we look like immediately
      const initialSkin = useGameStore.getState().player.selectedSkin;
      channel.emit('pos', { 
        skin: initialSkin,
        pos: [0, 103, 0], // Start at the lobby spawn
        rot: Math.PI 
      });

      // 2. Handle the initial list of players
      channel.on('currentPlayers', (players) => {
        updateRemotePlayers(players);
      });

      // Handle the regular updates (20 times per second)
      channel.on('update', (data) => {
        // Handle both old array format and new { p, t } format
        const players = Array.isArray(data) ? data : (data?.p || []);
        updateRemotePlayers(players);
      });

      // Handle a player leaving
      channel.on('removePlayer', (id) => {
        removeRemotePlayer(id);
      });

      // Handle being hit by another player
      channel.on('impact', (data) => {
        // data: { victimId, dir, position }
        const localId = useGameStore.getState().player.networkId;
        
        // 1. If it's me, trigger local knockback
        if (data.victimId === localId) {
          console.log("🛡️ Received IMPACT! Applying knockback.");
          triggerKnockback({ x: data.dir[0], y: data.dir[1], z: data.dir[2] });
          if (data.position) {
            addShockwave(data.position);
          }
        } 
        // 2. If it's someone else, track it so we can disable their magnet and apply local impulse
        else {
          useGameStore.getState().triggerRemoteKnockback(data.victimId, data.dir);
        }
      });

      // Handle latency pong
      channel.on('pong', (t) => {
        const rtt = Date.now() - t;
        useGameStore.getState().setLatency(rtt);
      });
      // Periodic ping
      const pingInterval = setInterval(() => {
        channel.emit('ping', Date.now());
      }, 2000);

      return () => {
        clearInterval(pingInterval);
        channel.close();
      };
    });
  }, [gameState, updateRemotePlayers, removeRemotePlayer, setNetworkId, setNetworkStatus]);

  // Function to send our current position and animation state
  const sendUpdate = (data) => {
    if (channelRef.current) {
      if (data.type === 'impact') {
        channelRef.current.emit('impact', data);
      } else {
        channelRef.current.emit('pos', data);
      }
    }
  };

  return { sendUpdate };
}


