import { useEffect, useRef } from 'react';
import geckos from '@geckos.io/client';
import { useGameStore } from '../store/useGameStore';

/**
 * THE MULTIPLAYER HOOK
 * Handles connection to the Geckos server and syncing data.
 */
export function useMultiplayer() {
  const channelRef = useRef(null);
  const { updateRemotePlayers, removeRemotePlayer, setNetworkId } = useGameStore(state => ({
    updateRemotePlayers: state.updateRemotePlayers,
    removeRemotePlayer: state.removeRemotePlayer,
    setNetworkId: state.setNetworkId
  }));

  useEffect(() => {
    // 1. Connect to the Geckos server
    // Default port is 9208
    const channel = geckos({ port: 9208 });
    channelRef.current = channel;

    channel.onConnect(error => {
      if (error) {
        console.warn('[Network] Connection failed:', error.message);
        return;
      }

      console.log('[Network] Connected to multiplayer server! ID:', channel.id);
      setNetworkId(channel.id);

      // 2. Handle list updates from server
      channel.on('update', (players) => {
        updateRemotePlayers(players);
      });

      // 3. Handle player removal
      channel.on('removePlayer', (id) => {
        removeRemotePlayer(id);
      });
    });

    return () => {
      channel.close();
    };
  }, [updateRemotePlayers, removeRemotePlayer, setNetworkId]);

  // Function to send our current state to the server
  const sendUpdate = (pos, rot, skin, animState) => {
    if (channelRef.current) {
      channelRef.current.emit('pos', {
        pos: { x: pos.x, y: pos.y, z: pos.z },
        rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        skin: skin,
        isMoving: animState.isMoving,
        moveDir: animState.moveDir,
        isSprinting: animState.isSprinting,
        jumpPhase: animState.jumpPhase,
        username: useGameStore.getState().player.username
      });
    }
  };

  return { sendUpdate };
}
