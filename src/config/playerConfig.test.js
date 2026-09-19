import { describe, it, expect } from 'vitest';
import { getDashConfig, getMaxJumps, shouldEndDash } from './playerConfig.js';

describe('dash config', () => {
  it('uses the baseline dash values when no power-up is active', () => {
    expect(getDashConfig()).toMatchObject({
      duration: 0.3,
      maxDistance: 6,
      maxDistanceMultiplier: 1,
      cooldown: 1,
    });
  });

  it('applies dash power-up multipliers for rarities', () => {
    expect(getDashConfig('gold')).toMatchObject({
      duration: 0.3,
      maxDistance: 54,
      maxDistanceMultiplier: 9,
      cooldown: 1,
    });
  });

  it('does not end a dash immediately before it has traveled far enough', () => {
    expect(shouldEndDash({ travelDistance: 0, maxDistance: 6, hSpeed: 0 })).toBe(false);
  });

  it('ends the dash once it reaches the configured distance cap', () => {
    expect(shouldEndDash({ travelDistance: 6, maxDistance: 6, hSpeed: 0 })).toBe(true);
  });
});

describe('jump config', () => {
  it('uses the baseline jump count when no jump power-up is active', () => {
    expect(getMaxJumps()).toBe(2);
    expect(getMaxJumps({ category: 'speed', rarity: 'gold' })).toBe(2);
  });

  it('uses the jump power-up count only when the active power-up is a jump power-up', () => {
    expect(getMaxJumps({ category: 'jump', rarity: 'gold' })).toBe(5);
  });
});
