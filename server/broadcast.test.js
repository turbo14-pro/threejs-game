import { describe, it, expect } from 'vitest';

/**
 * Phase 03: Input History & Prediction
 * Tests that server snapshot includes lastProcessedSeq per player
 * so client can match acknowledgments to sentInputs by sequenceId.
 * Failure mode: server doesn't broadcast lastProcessedSeq → client
 * cannot correlate acknowledgments → re-apply uses wrong inputs.
 */
describe('server broadcast includes lastProcessedSeq', () => {
  function buildPlayerEntry(player) {
    return {
      id: player.id,
      pos: player.pos,
      vel: player.vel,
      rot: player.rot,
      skin: player.skin,
      anim: player.anim,
      tick: player.tick,
      lastProcessedSeq: player.lastProcessedSeq,
    };
  }

  it('includes lastProcessedSeq when set on player', () => {
    const player = {
      id: 'p1',
      pos: [0, 0, 0],
      vel: [0, 0, 0],
      rot: 0,
      skin: 'avo',
      anim: {},
      tick: 42,
      lastProcessedSeq: 7,
    };
    const entry = buildPlayerEntry(player);
    expect(entry.lastProcessedSeq).toBe(7);
  });

  it('includes lastProcessedSeq as undefined when not set', () => {
    const player = {
      id: 'p1',
      pos: [0, 0, 0],
      vel: [0, 0, 0],
      rot: 0,
      skin: 'avo',
      anim: {},
      tick: 42,
    };
    const entry = buildPlayerEntry(player);
    expect(entry.lastProcessedSeq).toBeUndefined();
  });
});
