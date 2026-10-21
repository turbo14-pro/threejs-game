import { useEffect, useRef } from 'react';
import geckos from '@geckos.io/client';
import { useGameStore } from '../store/useGameStore';
import { debugLog, debugWarn, debugError } from '../utils/debugLog.js';
import { createInputSequenceTracker } from '../utils/inputSequence.js';

/**
 * THE MULTIPLAYER HOOK
 * Handles the connection and syncing with the Geckos server.
 */
export function useNetworking() {
  const channelRef = useRef(null);
  const sequenceTracker = useRef(createInputSequenceTracker());
  const gameState = useGameStore(state => state.game.state);
  const updateRemotePlayers = useGameStore(state => state.updateRemotePlayers);
  const removeRemotePlayer = useGameStore(state => state.removeRemotePlayer);
  const setNetworkId = useGameStore(state => state.setNetworkId);
  const setNetworkStatus = useGameStore(state => state.setNetworkStatus);
  const triggerKnockback = useGameStore(state => state.triggerKnockback);
  const addShockwave = useGameStore(state => state.addShockwave);
  const triggerRipple = useGameStore(state => state.triggerRipple);

  useEffect(() => {
    // Only connect when we are in the game
    if (gameState === 'MENU') {
      if (channelRef.current) {
        try {
          channelRef.current.close();
        } catch (e) {
          debugWarn("Error closing Geckos channel during MENU transition:", e);
        }
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
    
    debugLog('%c 📡 [Network Trace] Starting Connection Sequence...', 'color: #00ff88; font-weight: bold;');
    debugLog('   > Mode:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');
    debugLog('   > Raw Env URL:', rawEnvUrl);

    // CLEANING THE URL: Remove any trailing ports or slashes
    const baseAddress = rawEnvUrl.replace(':9208', '').replace(/\/$/, '');
    
    // In dev we hit the raw port 9208. In prod, Nginx handles SSL on port 443.
    const targetPort = isDev ? 9208 : 443;
    
    debugLog('   > Base Address:', baseAddress);
    debugLog('   > Target Port:', targetPort);

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

    debugLog('   > Geckos Instance Created with STUN. Waiting for handshake...');

    channel.onConnect(error => {
      if (error) {
        debugError('%c ❌ [Network Trace] Handshake Failed!', 'color: #ff4444; font-weight: bold;');
        debugError('   > Error Message:', error.message);
        debugError('   > Error Type:', error.name || 'Unknown');
        debugError('   > Target URL:', baseAddress);
        debugError('   > Target Port:', targetPort);
        debugError('   > Is Dev Mode:', isDev);
        debugError('   > Raw Env URL:', rawEnvUrl);
        debugError('   > Check if the browser is blocking HTTP to an IP address (Mixed Content).');
        debugError('   > Check if your system clock is correct (SSL certificate validation depends on accurate time).');
        debugError('   > Try accessing https://ff-server-9208.duckdns.org in your browser to see if you get a certificate warning.');
        setNetworkStatus('ERROR');
        return;
      }

      debugLog('%c ✅ [Network Trace] Handshake Success!', 'color: #00ff88; font-weight: bold;');
      debugLog('   > Connection ID:', channel.id);
      setNetworkId(channel.id);
      setNetworkStatus('ONLINE');

      // 1. Tell the server who we are and what we look like immediately
      const initialSkin = useGameStore.getState().player.selectedSkin;
      channel.emit('pos', { 
        skin: initialSkin,
        pos: [0, 103, 0], // Start at the lobby spawn
        rot: Math.PI,
        anim: { mv: false, dir: 'for', jp: 'none', spr: true }
      });

      // 2. Handle the initial list of players
      channel.on('currentPlayers', (players) => {
        updateRemotePlayers(players);
      });

      // Handle the regular updates (20 times per second)
      channel.on('update', (data) => {
        // Handle both old array format and new { p, t } format
        const players = Array.isArray(data) ? data : (data?.p || []);
        const serverTick = data?.t;
        updateRemotePlayers(players);
        
        // Update server tick in store for LatencyGraph
        if (serverTick !== undefined) {
          useGameStore.getState().setServerTick(serverTick);
        }
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
          debugLog("🛡️ Received IMPACT! Applying knockback.");
          triggerKnockback({ x: data.dir[0], y: data.dir[1], z: data.dir[2] }, 250 * (data.slideMultiplier || 1));
          triggerRipple();
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
      const pingInterval = setInterval(() => {
        channel.emit('ping', Date.now());
      }, 2000);
      
      // Store interval ID on channel to clean it up later
      channel._pingInterval = pingInterval;
    });

    return () => {
      if (channelRef.current) {
        if (channelRef.current._pingInterval) {
          clearInterval(channelRef.current._pingInterval);
        }
        try {
          channelRef.current.close();
        } catch(e) {
          debugWarn("Error closing Geckos channel:", e);
        }
      }
    };
  }, [gameState, updateRemotePlayers, removeRemotePlayer, setNetworkId, setNetworkStatus]);

  // Function to send our current position and animation state
  // Returns the sequenceId assigned to input packets (undefined for non-input).
  const sendUpdate = (data) => {
    if (channelRef.current) {
      if (data.type === 'impact') {
        channelRef.current.emit('impact', data);
      } else if (data.type === 'input') {
        // Tag input with a monotonically increasing sequenceId so the server
        // can reject duplicates and out-of-order inputs (Phase 01).
        const sequenceId = sequenceTracker.current.next();
        channelRef.current.emit('input', {
          ...data,
          sequenceId,
        });
        return sequenceId;
      } else {
        // Legacy position update
        channelRef.current.emit('pos', data);
      }
    }
    return undefined;
  };

  return { sendUpdate };
}

