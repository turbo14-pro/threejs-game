/**
 * Phase 01: Input Sequence Numbers
 * Pure sequence tracker for input packets.
 * Returns a function that yields monotonically increasing sequence IDs,
 * starting at 0. Used by useNetworking to tag each input packet so the
 * server can reject duplicates and out-of-order inputs.
 */
export function createInputSequenceTracker() {
  let nextId = 0;
  return {
    next: () => nextId++,
    peek: () => nextId,
    reset: () => { nextId = 0; },
  };
}
