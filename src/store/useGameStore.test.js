import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { BOT_DIFFICULTY } from '../components/Player/BotAI.jsx';

describe('CPU bot store state', () => {
  beforeEach(() => {
    useGameStore.setState({
      bots: [],
      botCount: 0,
      botDifficulty: BOT_DIFFICULTY.normal,
      matchScore: { player: 0, bots: 0 },
    });
  });

  it('always runs 3 bots on normal skill — the setters are locked no-ops', () => {
    useGameStore.getState().setBotCount(1);
    useGameStore.getState().setBotDifficulty(BOT_DIFFICULTY.insane);

    const { bots, botCount, botDifficulty } = useGameStore.getState();
    expect(botCount).toBe(3);
    expect(botDifficulty).toBe(BOT_DIFFICULTY.normal);
    expect(bots).toHaveLength(3);
    expect(bots.map(b => b.name)).toEqual(['Bot Byte', 'Bot Crumb', 'Bot Munch']);
    expect(bots.every(b => b.difficulty === BOT_DIFFICULTY.normal)).toBe(true);
  });

  it('credits match score to the side that earned it', () => {
    useGameStore.getState().addMatchScore('bots', 2);
    useGameStore.getState().addMatchScore('player');

    expect(useGameStore.getState().matchScore).toEqual({ player: 1, bots: 2 });
  });

  it('never lets a match score go negative', () => {
    useGameStore.getState().addMatchScore('player', -5);

    expect(useGameStore.getState().matchScore.player).toBe(0);
  });

  it('awards the player a point for collecting a power-up, which drives bot difficulty', () => {
    useGameStore.getState().collectPowerUp('speed', 'gold');

    expect(useGameStore.getState().matchScore.player).toBe(1);
  });

  it('resets both match scores', () => {
    useGameStore.getState().addMatchScore('player', 3);
    useGameStore.getState().addMatchScore('bots', 4);
    useGameStore.getState().resetMatchScore();

    expect(useGameStore.getState().matchScore).toEqual({ player: 0, bots: 0 });
  });
});

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
