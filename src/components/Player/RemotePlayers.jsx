import React, { memo, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import RemotePlayer from './RemotePlayer.jsx';

import { useShallow } from 'zustand/react/shallow';

/**
 * REMOTE PLAYERS MANAGER
 * Optimized to only rerender when players JOIN or LEAVE.
 * Regular movement updates (20hz) will NOT trigger a React reconciliation of this entire list.
 */
const RemotePlayers = memo(() => {
  // We only select the KEYS (IDs) of the remote players.
  // Using 'useShallow' ensures this component ONLY rerenders if IDs are added or removed.
  const remotePlayerIds = useGameStore(useShallow(state => Object.keys(state.remotePlayers)));

  return (
    <>
      {remotePlayerIds.map((id) => (
        <RemotePlayerDataWrapper key={id} id={id} />
      ))}
    </>
  );
});

/**
 * This wrapper pulls the specific data for ONE player.
 * It's memoized so it only checks its own player data.
 */
const RemotePlayerDataWrapper = memo(({ id }) => {
  // Only subscribe to the specific data for this ID
  const data = useGameStore(state => state.remotePlayers[id]);
  
  if (!data) return null;
  
  return <RemotePlayer data={data} />;
});

export default RemotePlayers;
