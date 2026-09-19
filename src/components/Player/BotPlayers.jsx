import React, { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/useGameStore';
import BotPlayer from './BotPlayer.jsx';

/**
 * BOT PLAYERS MANAGER
 * Mirrors RemotePlayers: it only re-renders when the ROSTER changes (bots added or
 * removed), never on per-frame movement or score updates.
 */
export default function BotPlayers() {
  const botIds = useGameStore(useShallow(state => state.bots.map(b => b.id)));

  return (
    <>
      {botIds.map((id, index) => (
        <BotDataWrapper key={id} id={id} spawnIndex={index} />
      ))}
    </>
  );
}

/**
 * Pulls the roster entry for ONE bot so its difficulty/skin can change without
 * reconciling the whole list.
 */
const BotDataWrapper = memo(({ id, spawnIndex }) => {
  const bot = useGameStore(useShallow(state => state.bots.find(b => b.id === id)));

  if (!bot) return null;

  return <BotPlayer bot={{ ...bot, spawnIndex }} />;
});