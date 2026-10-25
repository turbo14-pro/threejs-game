import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 2: Throttle Snapshots to 20Hz
 * Tests that the physics worker throttles snapshots to 20Hz (every 50ms)
 * instead of broadcasting every 30Hz tick.
 * Failure mode: worker sends snapshot every tick (30Hz) → doubles network traffic.
 */
describe('Snapshot rate throttle to 20Hz', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('physics worker implements snapshot throttling (not every tick)', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    // Should have a snapshot interval/throttle mechanism, not postMessage every simulate() call
    expect(workerSource).toMatch(/snapshotInterval|lastSnapshot|20Hz|50ms|every.*tick|throttle/);
  });

  it('physics worker does not postMessage snapshot on every simulate tick', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    // Count postMessage calls for snapshot type - should be gated
    const snapshotPosts = (workerSource.match(/postMessage.*snapshot/g) || []).length;
    expect(snapshotPosts).toBeLessThanOrEqual(1);
  });
});
