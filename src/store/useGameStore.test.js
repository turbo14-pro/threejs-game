import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './useGameStore.js';

describe('Ripple debug state', () => {
  beforeEach(() => {
    useGameStore.setState({
      debugRipple: {
        enabled: true,
        worldPosition: { x: 0, y: 0, z: 0 },
        screenPosition: { x: 0, y: 0 },
      },
    });
  });

  it('stores the latest player world position for debugging', () => {
    useGameStore.getState().setRippleDebugPosition({ x: 12, y: 3, z: -4 });

    expect(useGameStore.getState().debugRipple.worldPosition).toEqual({ x: 12, y: 3, z: -4 });
  });
});
