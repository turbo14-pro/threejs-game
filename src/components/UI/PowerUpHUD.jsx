import { useState, useEffect } from 'react';
import { useGameStore, POWERUP_DURATIONS } from '../../store/useGameStore';

// ---------------------------------------------------------------------------
// Category + rarity config (visual only)
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG = {
  jump:  { color: '#00ff88', label: 'Jump' },
  speed: { color: '#ff8800', label: 'Speed' },
  dash:  { color: '#4488ff', label: 'Dash' },
  slide: { color: '#ff44ff', label: 'Slide' },
};

const RARITY_CONFIG = {
  bronze:  { color: '#ffaa44' },
  silver:  { color: '#aaddff' },
  gold:    { color: '#ffcc00' },
  diamond: { color: '#44ccff' },
};

// ---------------------------------------------------------------------------
// PowerUpHUD — displays active power-up with category, rarity, countdown
// ---------------------------------------------------------------------------

export function PowerUpHUD() {
  const powerUp = useGameStore((s) => s.powerUp);
  const [remaining, setRemaining] = useState(0);

  // Tick remaining time every frame-ish (100ms)
  useEffect(() => {
    if (!powerUp) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, powerUp.expiresAt - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [powerUp]);

  if (!powerUp) return null;

  const catCfg = CATEGORY_CONFIG[powerUp.category] ?? CATEGORY_CONFIG.speed;
  const rarCfg = RARITY_CONFIG[powerUp.rarity] ?? RARITY_CONFIG.bronze;
  const totalDuration = (POWERUP_DURATIONS[powerUp.rarity] ?? 120) * 1000;
  const progress = remaining / totalDuration;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        background: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        padding: '10px 16px',
        minWidth: 120,
        fontFamily: 'monospace',
        color: '#fff',
        transition: 'opacity 0.3s',
        opacity: powerUp ? 1 : 0,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 'bold', color: catCfg.color }}>
        {catCfg.label}
      </div>
      <div style={{ fontSize: 12, color: rarCfg.color, textTransform: 'uppercase' }}>
        {powerUp.rarity}
      </div>
      <div
        style={{
          marginTop: 6,
          width: '100%',
          height: 4,
          background: '#333',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: catCfg.color,
            borderRadius: 2,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 4, textAlign: 'right' }}>
        {remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : 'Expired'}
      </div>
    </div>
  );
}
