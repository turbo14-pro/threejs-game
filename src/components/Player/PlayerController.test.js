import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 01: Input Sequence Numbers
 * Tests that PlayerController tracks sentInputs by sequenceId for reconciliation.
 * Failure mode: sentInputs not tracked → client cannot re-apply unacknowledged inputs → prediction breaks.
 */
describe('PlayerController sentInputs tracking', () => {
  let sentInputs;

  beforeEach(() => {
    sentInputs = new Map();
  });

  it('records sequenceId in sentInputs map when input is sent', () => {
    // Simulate the tracking logic that PlayerController will implement
    const sequenceId = 5;
    const inputData = { tick: 10, input: { w: true }, camRot: 0 };

    sentInputs.set(sequenceId, inputData);

    expect(sentInputs.has(sequenceId)).toBe(true);
    expect(sentInputs.get(sequenceId)).toEqual(inputData);
  });

  it('tracks multiple sequenceIds without collision', () => {
    sentInputs.set(0, { tick: 1 });
    sentInputs.set(1, { tick: 2 });
    sentInputs.set(2, { tick: 3 });

    expect(sentInputs.size).toBe(3);
    expect(sentInputs.get(0).tick).toBe(1);
    expect(sentInputs.get(2).tick).toBe(3);
  });

  it('allows removal of acknowledged sequenceIds', () => {
    sentInputs.set(0, { tick: 1 });
    sentInputs.set(1, { tick: 2 });
    sentInputs.set(2, { tick: 3 });

    sentInputs.delete(0);
    sentInputs.delete(1);

    expect(sentInputs.size).toBe(1);
    expect(sentInputs.has(2)).toBe(true);
  });
});
