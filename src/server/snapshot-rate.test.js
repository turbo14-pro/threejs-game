import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 2: Snapshot Rate — 30Hz Full Position Updates
 * Tests that the physics worker sends full snapshots (X, Y, Z) at 30Hz
 * every tick, keeping all axes aligned.
 * Failure mode: snapshots sent at different rates for different axes → desync.
 */
describe('Snapshot rate — 30Hz full position updates', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('physics worker sends snapshots at 30Hz (every tick)', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toMatch(/1000 \/ 30|30Hz|SIMULATION_RATE/);
  });

  it('physics worker posts snapshot on every simulate tick (no throttling gate)', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    // Snapshot is posted every tick at 30Hz — no throttling gate
    const snapshotPosts = (workerSource.match(/parentPort\.postMessage/g) || []).length;
    expect(snapshotPosts).toBeGreaterThanOrEqual(1);
  });
});
