import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './useGameStore.js';

describe('player world position in the store', () => {
  beforeEach(() => {
    useGameStore.setState((state) => ({
      player: { ...state.player, position: { x: 0, y: 0, z: 0 } },
    }));
  });

  it('starts at the world origin', () => {
    expect(useGameStore.getState().player.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('publishes the latest player world coordinates', () => {
    useGameStore.getState().setPlayerPosition({ x: 10, y: 4, z: -10 });

    expect(useGameStore.getState().player.position).toEqual({ x: 10, y: 4, z: -10 });
  });

  it('keeps the same object identity so per-frame reads never re-render subscribers', () => {
    const before = useGameStore.getState().player.position;

    useGameStore.getState().setPlayerPosition({ x: 1, y: 2, z: 3 });

    expect(useGameStore.getState().player.position).toBe(before);
  });

  it('ignores non-finite coordinates from a physics glitch', () => {
    useGameStore.getState().setPlayerPosition({ x: 5, y: 6, z: 7 });

    useGameStore.getState().setPlayerPosition({ x: Number.NaN, y: 0, z: 0 });

    expect(useGameStore.getState().player.position).toEqual({ x: 5, y: 6, z: 7 });
  });
});
