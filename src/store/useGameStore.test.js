import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { BOT_DIFFICULTY, BOT_NAME_POOL } from '../components/Player/BotAI.jsx';

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
    // Names are random from the food-fighter pool (unique within the batch)
    expect(bots.map(b => b.name).every(name => BOT_NAME_POOL.includes(name))).toBe(true);
    expect(new Set(bots.map(b => b.name)).size).toBe(3);
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

describe('Multiplayer tick and velocity state', () => {
  beforeEach(() => {
    useGameStore.setState({
      game: {
        state: 'PLAYING',
        networkStatus: 'ONLINE',
        networkId: 'test-id',
        remotePlayers: [],
        phase: 'BATTLE',
        countdown: 0,
        currentLevel: 'kitchen_table',
        startTime: Date.now(),
        latency: 0,
        serverTick: 0,
        desyncCount: 0,
      },
      player: {
        networkId: 'test-id',
      },
      lastServerState: null,
    });
  });

  it('stores lastServerState with pos, vel, tick, serverTick', () => {
    const serverState = {
      pos: [10, 100, 20],
      vel: [5, 0, -3],
      tick: 100,
      serverTick: 105,
    };
    
    useGameStore.getState().updateRemotePlayers([{
      id: 'test-id',
      pos: serverState.pos,
      vel: serverState.vel,
      tick: serverState.tick,
    }]);

    const state = useGameStore.getState().lastServerState;
    expect(state).not.toBeNull();
    expect(state.pos).toEqual(serverState.pos);
    expect(state.tick).toBe(serverState.tick);
  });

  it('increments desyncCount on reconciliation', () => {
    expect(useGameStore.getState().game.desyncCount).toBe(0);
    
    useGameStore.getState().incrementDesyncCount();
    expect(useGameStore.getState().game.desyncCount).toBe(1);
    
    useGameStore.getState().incrementDesyncCount();
    expect(useGameStore.getState().game.desyncCount).toBe(2);
    
    useGameStore.getState().resetDesyncCount();
    expect(useGameStore.getState().game.desyncCount).toBe(0);
  });

  it('stores and retrieves serverTick', () => {
    expect(useGameStore.getState().game.serverTick).toBe(0);
    
    useGameStore.getState().setServerTick(100);
    expect(useGameStore.getState().game.serverTick).toBe(100);
    
    useGameStore.getState().setServerTick(200);
    expect(useGameStore.getState().game.serverTick).toBe(200);
  });
});

/**
 * Phase 04: Full State Snapshots
 * Tests that lastServerState captures lastProcessedSeq from server broadcast
 * so client can acknowledge sentInputs by sequenceId instead of tick.
 * Failure mode: lastProcessedSeq not captured → client can't match
 * acknowledgments → sentInputs never cleaned up → memory leak + wrong re-apply.
 */
describe('lastServerState captures lastProcessedSeq', () => {
  beforeEach(() => {
    useGameStore.setState({
      remotePlayers: {},
      lastServerState: null,
      player: { networkId: 'local1', health: 100 },
    });
  });

  it('captures lastProcessedSeq for the local player', () => {
    useGameStore.getState().updateRemotePlayers([
      { id: 'local1', pos: [0, 0, 0], vel: [0, 0, 0], tick: 42, lastProcessedSeq: 7 },
      { id: 'remote1', pos: [10, 0, 0], vel: [0, 0, 0], tick: 42, lastProcessedSeq: 3 },
    ]);

    const { lastServerState } = useGameStore.getState();
    expect(lastServerState).not.toBeNull();
    expect(lastServerState.lastProcessedSeq).toBe(7);
  });

  it('captures pos, tick, vel alongside lastProcessedSeq', () => {
    useGameStore.getState().updateRemotePlayers([
      { id: 'local1', pos: [1, 2, 3], vel: [4, 5, 6], tick: 100, lastProcessedSeq: 9 },
    ]);

    const { lastServerState } = useGameStore.getState();
    expect(lastServerState.pos).toEqual([1, 2, 3]);
    expect(lastServerState.tick).toBe(100);
    expect(lastServerState.vel).toEqual([4, 5, 6]);
    expect(lastServerState.lastProcessedSeq).toBe(9);
  });

  it('lastServerState is null when local player not in list', () => {
    useGameStore.getState().updateRemotePlayers([
      { id: 'remote1', pos: [0, 0, 0], vel: [0, 0, 0], tick: 1, lastProcessedSeq: 0 },
    ]);

    expect(useGameStore.getState().lastServerState).toBeNull();
  });
});
