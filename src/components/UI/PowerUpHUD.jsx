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
      className="power-up-hud"
      style={{ opacity: powerUp ? 1 : 0 }}
    >
      <div className="power-up-hud-label" style={{ color: catCfg.color }}>
        {catCfg.label}
      </div>
      <div className="power-up-hud-rarity" style={{ color: rarCfg.color }}>
        {powerUp.rarity}
      </div>
      <div className="power-up-hud-bar-bg">
        <div
          className="power-up-hud-bar-fill"
          style={{
            width: `${progress * 100}%`,
            background: catCfg.color,
          }}
        />
      </div>
      <div className="power-up-hud-time">
        {remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : 'Expired'}
      </div>
    </div>
  );
}
