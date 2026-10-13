import React from 'react';
import { useGameStore } from '../../store/useGameStore';

/**
 * CPU OPPONENT ROSTER
 * Shows who the player is up against. Read-only: every match runs 3 bots
 * on normal skill — there are no lobby selectors.
 */
export default function BotRoster() {
  const bots = useGameStore(state => state.bots);

  return (
    <div className="bot-panel">
      <div className="bot-panel-title">CPU Opponents</div>

      <div className="bot-roster">
        {bots.length === 0 ? (
          <div className="bot-roster-empty">No CPU opponents — solo practice</div>
        ) : (
          bots.map(bot => (
            <div className="bot-roster-row" key={bot.id}>
              <span className="bot-roster-dot" />
              <span className="bot-roster-name">{bot.name}</span>
              <span className="bot-roster-tag">{bot.difficultyName}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}