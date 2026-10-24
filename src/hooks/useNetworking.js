import { useEffect, useRef } from 'react';
import { encode, decode } from 'msgpackr';
import { useGameStore } from '../store/useGameStore';
import { debugLog, debugWarn, debugError } from '../utils/debugLog.js';
import { createInputSequenceTracker } from '../utils/inputSequence.js';

/**
 * THE MULTIPLAYER HOOK
 * Handles the connection and syncing with the WS binary server.
 * Replaces Geckos.io WebRTC with native WebSocket + msgpackr binary protocol.
 */
export function useNetworking() {
  const wsRef = useRef(null);
  const sequenceTracker = useRef(createInputSequenceTracker());
  const playerIdRef = useRef(null);
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
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          debugWarn("Error closing WS connection during MENU transition:", e);
        }
        wsRef.current = null;
        playerIdRef.current = null;
        setNetworkStatus('OFFLINE');
      }
      return;
    }

    // --- DEBUG TRACE: START ---
    const isDev = import.meta.env.DEV;
    const rawEnvUrl = isDev
      ? import.meta.env.VITE_SERVER_URL_LOCAL
      : import.meta.env.VITE_SERVER_URL_PRODUCTION;

    debugLog('%c 📡 [Network Trace] Starting WS Connection Sequence...', 'color: #00ff88; font-weight: bold;');
    debugLog('   > Mode:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');
    debugLog('   > Raw Env URL:', rawEnvUrl);

    // Build WS URL: ws:// for dev, wss:// for prod
    // Strip any http:// or https:// prefix from the env URL
    const baseAddress = rawEnvUrl
      .replace(/^https?:\/\//, '')
      .replace(':9208', '')
      .replace(/\/$/, '');
    const wsUrl = isDev ? `ws://${baseAddress}:9208` : `wss://${baseAddress}`;

    debugLog('   > WS URL:', wsUrl);

    // Tell the UI we are looking for the server
    setNetworkStatus('CONNECTING');

    // Connect to the WS binary server
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    debugLog('   > WebSocket Created. Waiting for open...');

    ws.onopen = () => {
      debugLog('%c ✅ [Network Trace] WS Handshake Success!', 'color: #00ff88; font-weight: bold;');
      setNetworkStatus('ONLINE');

      // Send initial player info (skin, position) as a pos message
      const initialSkin = useGameStore.getState().player.selectedSkin;
      ws.send(encode({
        type: 'pos',
        skin: initialSkin,
        pos: [0, 103, 0],
        rot: Math.PI,
        anim: { mv: false, dir: 'for', jp: 'none', spr: true },
      }, { binary: true }));
    };

    ws.onmessage = (event) => {
      const data = decode(new Uint8Array(event.data));

      switch (data.type) {
        case 'welcome': {
          // Server assigns our playerId — store it for tagging inputs
          playerIdRef.current = data.playerId;
          setNetworkId(data.playerId);
          debugLog('   > Assigned playerId:', data.playerId);
          break;
        }

        case 'snapshot': {
          // Handle { p: [...], t: serverTick } snapshot format
          const players = data.p || [];
          const serverTick = data.t;
          players.forEach(p => {
            if (p.pos) {
              console.log(`[NETWORKING HOOK RECEIVE] player=${p.id} posY=${p.pos[1]?.toFixed(2)}`);
            }
          });
          updateRemotePlayers(players);

          // Update server tick in store for LatencyGraph
          if (serverTick !== undefined) {
            useGameStore.getState().setServerTick(serverTick);
          }
          break;
        }

        case 'removePlayer': {
          removeRemotePlayer(data.id);
          break;
        }

        case 'impact': {
          const localId = useGameStore.getState().player.networkId;
          if (data.victimId === localId) {
            debugLog("🛡️ Received IMPACT! Applying knockback.");
            triggerKnockback({ x: data.dir[0], y: data.dir[1], z: data.dir[2] }, 250 * (data.slideMultiplier || 1));
            triggerRipple();
            if (data.position) {
              addShockwave(data.position);
            }
          } else {
            useGameStore.getState().triggerRemoteKnockback(data.victimId, data.dir);
          }
          break;
        }

        case 'pong': {
          const rtt = Date.now() - data.t;
          useGameStore.getState().setLatency(rtt);
          break;
        }

        default:
          debugWarn(`[Network Trace] Unknown WS message type: ${data.type}`);
      }
    };

    ws.onerror = (error) => {
      debugError('%c ❌ [Network Trace] WS Error!', 'color: #ff4444; font-weight: bold;');
      debugError('   > Error:', error.message);
      setNetworkStatus('ERROR');
    };

    ws.onclose = () => {
      debugLog('   > WS Connection closed.');
      wsRef.current = null;
      playerIdRef.current = null;
      setNetworkStatus('OFFLINE');
    };

    // Ping interval for latency measurement
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(encode({ type: 'ping', t: Date.now() }, { binary: true }));
      }
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          debugWarn("Error closing WS connection:", e);
        }
        wsRef.current = null;
        playerIdRef.current = null;
      }
    };
  }, [gameState, updateRemotePlayers, removeRemotePlayer, setNetworkId, setNetworkStatus]);

  // Function to send input to the WS binary server
  // Returns the sequenceId assigned to input packets.
  const sendUpdate = (data) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (data.type === 'impact') {
        ws.send(encode(data, { binary: true }));
      } else if (data.type === 'input') {
        // Tag input with a monotonically increasing sequenceId so the server
        // can reject duplicates and out-of-order inputs (Phase 01).
        const sequenceId = sequenceTracker.current.next();
        ws.send(encode({
          type: 'input',
          playerId: playerIdRef.current,
          ...data,
          sequenceId,
        }, { binary: true }));
        return sequenceId;
      } else {
        // Legacy position update
        ws.send(encode({ type: 'pos', ...data }, { binary: true }));
      }
    }
    return undefined;
  };

  return { sendUpdate };
}

