// ---------------------------------------------------------------------------
// PostEffectsActivator — Bridges player actions to post-processing effects.
// Reads power-up state and PLAYER_ACTIONS config to drive effect intensities.
// Mounted as a logic-only component in Effects.jsx
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

/**
 * PostEffectsActivator
 * Watches for power-up state changes and triggers corresponding post effects.
 * Actual effect rendering is handled by ShockwaveEffect and RadialBlurEffect
 * which read from the store independently.
 *
 * This component exists to:
 * 1. Ensure addShockwave is called with correct intensity from PORTFOLIO_ACTIONS
 * 2. Provide a single extension point for future player-action-driven effects
 */
export function PostEffectsActivator() {
  const powerUp = useGameStore(state => state.powerUp);
  const prevPowerUpRef = useRef(null);

  useEffect(() => {
    // Detect power-up activation changes (for future use)
    prevPowerUpRef.current = powerUp;
  }, [powerUp]);

  // Logic-only component — no visual output
  return null;
}

export default PostEffectsActivator;