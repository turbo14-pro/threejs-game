import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { BOT_DIFFICULTY } from '../Player/BotAI.jsx';

/**
 * CPU OPPONENT ROSTER
 * Shows who the player is up against, and (optionally) lets them choose how many
 * bots to spawn plus how hard they should be. Shared by the main lobby and the
 * in-game pause menu.
 */
const COUNT_OPTIONS = [0, 1, 2, 3];
const DIFFICULTY_OPTIONS = Object.keys(BOT_DIFFICULTY);

export default function BotRoster({ showControls = false }) {
  const bots = useGameStore(state => state.bots);
  const botCount = useGameStore(state => state.botCount);
  const botDifficulty = useGameStore(state => state.botDifficulty);
  const setBotCount = useGameStore(state => state.setBotCount);
  const setBotDifficulty = useGameStore(state => state.setBotDifficulty);

  return (
    <div className="bot-panel">
      <div className="bot-panel-title">CPU Opponents</div>

      {showControls && (
        <div className="bot-options">
          <div className="bot-option-row">
            <span className="bot-option-label">Bots</span>
            <div className="bot-option-buttons">
              {COUNT_OPTIONS.map(count => (
                <button
                  key={count}
                  type="button"
                  className={`bot-option-btn${botCount === count ? ' selected' : ''}`}
                  onClick={() => setBotCount(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="bot-option-row">
            <span className="bot-option-label">Skill</span>
            <div className="bot-option-buttons">
              {DIFFICULTY_OPTIONS.map(name => (
                <button
                  key={name}
                  type="button"
                  className={`bot-option-btn${botDifficulty === BOT_DIFFICULTY[name] ? ' selected' : ''}`}
                  onClick={() => setBotDifficulty(BOT_DIFFICULTY[name])}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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