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
    <div style={{
      position: 'fixed',
      top: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'max-content',
      maxWidth: 'calc(100vw - 32px)',
      boxSizing: 'border-box',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 24px',
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      border: `2px solid ${desc.color}`,
      borderRadius: 12,
      boxShadow: `0 0 20px ${desc.color}44, 0 4px 12px rgba(0,0,0,0.5)`,
      animation: 'notifSlideIn 0.3s ease-out',
      transition: 'opacity 0.3s, transform 0.3s',
      opacity: visible ? 1 : 0,
      pointerEvents: 'none',
    }}>
      <img
        src={desc.icon}
        alt={desc.label}
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          objectFit: 'contain',
          filter: `drop-shadow(0 0 6px ${desc.color})`,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: rarityColor,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            {rarityLabel}
          </span>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            color: desc.color,
            textShadow: `0 0 8px ${desc.color}88`,
            whiteSpace: 'nowrap',
          }}>
            {desc.label}
          </span>
        </div>
        <div style={{
          fontSize: 12,
          color: '#ccc',
          fontFamily: 'monospace',
          overflowWrap: 'anywhere',
        }}>
          {hint}
        </div>
      </div>
    </div>
  );
}
