import React, { useEffect, useState } from 'react';
import { useGameStore, POWERUP_EFFECTS, POWERUP_DESCRIPTIONS } from '../../store/useGameStore';

const RARITY_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
};

const RARITY_COLORS = {
  bronze: '#ffaa44',
  silver: '#c0ddff',
  gold: '#ffcc00',
  diamond: '#44ccff',
};

export function PowerUpNotification() {
  const notification = useGameStore(state => state.notification);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (notification) {
      setData(notification);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [notification]);

  if (!data || !visible) return null;

  const desc = POWERUP_DESCRIPTIONS[data.category];
  if (!desc) return null;

  const rarityLabel = RARITY_LABELS[data.rarity] || data.rarity;
  const rarityColor = RARITY_COLORS[data.rarity] || '#fff';
  const effectVal = POWERUP_EFFECTS[data.category]?.[data.rarity] || '';
  const hint = desc.hint(data.rarity, effectVal);

  return (
    <div
      className="power-up-notification"
      style={{
        borderColor: desc.color,
        boxShadow: `0 0 20px ${desc.color}44, 0 4px 12px rgba(0,0,0,0.5)`,
        opacity: visible ? 1 : 0,
      }}
    >
      <img
        src={desc.icon}
        alt={desc.label}
        className="power-up-notification-icon"
        style={{
          filter: `drop-shadow(0 0 6px ${desc.color})`,
        }}
      />
      <div className="power-up-notification-content">
        <div className="power-up-notification-header">
          <span className="power-up-notification-rarity" style={{ color: rarityColor }}>
            {rarityLabel}
          </span>
          <span className="power-up-notification-label" style={{ color: desc.color }}>
            {desc.label}
          </span>
        </div>
        <div className="power-up-notification-hint">
          {hint}
        </div>
      </div>
    </div>
  );
}
