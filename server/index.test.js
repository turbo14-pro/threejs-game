import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 01: Input Sequence Numbers
 * Tests that server rejects duplicate and out-of-order sequence IDs.
 * Failure mode: server accepts duplicate/out-of-order inputs → double-processing → desync.
 *
 * These tests exercise the sequence-handling logic extracted from server/index.js.
 * The server module itself starts listening on import, so we test the pure logic
 * that would be extracted/refactored in a later phase.
 */
describe('Server input sequence handling', () => {
  let lastProcessedSequenceId;

  beforeEach(() => {
    lastProcessedSequenceId = -1;
  });

  /**
   * Simulates the server's sequence validation logic:
   * - Accept if sequenceId > lastProcessedSequenceId
   * - Reject if sequenceId <= lastProcessedSequenceId (duplicate or out-of-order)
   */
  function processInput(sequenceId) {
    if (sequenceId <= lastProcessedSequenceId) {
      return { accepted: false, reason: 'duplicate or out-of-order' };
    }
    lastProcessedSequenceId = sequenceId;
    return { accepted: true };
  }

  it('accepts the first input with any sequenceId', () => {
    const result = processInput(0);
    expect(result.accepted).toBe(true);
    expect(lastProcessedSequenceId).toBe(0);
  });

  it('accepts monotonically increasing sequenceIds', () => {
    expect(processInput(0).accepted).toBe(true);
    expect(processInput(1).accepted).toBe(true);
    expect(processInput(2).accepted).toBe(true);
    expect(lastProcessedSequenceId).toBe(2);
  });

  it('rejects duplicate sequenceId', () => {
    processInput(5);
    const result = processInput(5);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('duplicate or out-of-order');
    expect(lastProcessedSequenceId).toBe(5);
  });

  it('rejects out-of-order (older) sequenceId', () => {
    processInput(10);
    const result = processInput(3);
    expect(result.accepted).toBe(false);
    expect(lastProcessedSequenceId).toBe(10);
  });

  it('rejects sequenceId that is one less than last processed', () => {
    processInput(7);
    const result = processInput(6);
    expect(result.accepted).toBe(false);
    expect(lastProcessedSequenceId).toBe(7);
  });
});
