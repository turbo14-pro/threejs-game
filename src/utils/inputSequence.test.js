import { describe, it, expect } from 'vitest';
import { createInputSequenceTracker } from './inputSequence.js';

/**
 * Phase 01: Input Sequence Numbers
 * Tests that sequence IDs are monotonically increasing starting at 0.
 * Failure mode: non-monotonic or duplicate sequence IDs → server cannot
 * detect duplicate/out-of-order inputs → desync.
 */
describe('createInputSequenceTracker', () => {
  it('starts at 0 for the first input', () => {
    const tracker = createInputSequenceTracker();
    expect(tracker.next()).toBe(0);
  });

  it('increments monotonically on each call', () => {
    const tracker = createInputSequenceTracker();
    expect(tracker.next()).toBe(0);
    expect(tracker.next()).toBe(1);
    expect(tracker.next()).toBe(2);
  });

  it('maintains independent state per tracker instance', () => {
    const a = createInputSequenceTracker();
    const b = createInputSequenceTracker();
    expect(a.next()).toBe(0);
    expect(b.next()).toBe(0);
    expect(a.next()).toBe(1);
    expect(b.next()).toBe(1);
  });

  it('peek does not advance the counter', () => {
    const tracker = createInputSequenceTracker();
    expect(tracker.peek()).toBe(0);
    expect(tracker.next()).toBe(0);
    expect(tracker.peek()).toBe(1);
  });

  it('reset returns counter to 0', () => {
    const tracker = createInputSequenceTracker();
    tracker.next();
    tracker.next();
    tracker.reset();
    expect(tracker.next()).toBe(0);
  });
});
