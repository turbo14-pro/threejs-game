import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 4: Fix Y Throttle — Align X, Y, Z to Same Update Rate
 * Tests that all position axes (X, Y, Z) update at the same rate (30Hz)
 * to keep physics calculations consistent across axes.
 * Failure mode: Y updates at different rate than X/Z → desync between axes.
 */
describe('Y position throttle — aligned to same rate as X/Z', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('physics worker does not implement decoupled Y position updates', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).not.toMatch(/yOnly|yUpdate|Y_INTERVAL|yInterval/);
  });

  it('physics worker sends full snapshots (X, Y, Z) at 30Hz every tick', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toMatch(/1000 \/ 30|30Hz|SIMULATION_RATE/);
    expect(workerSource).toContain('no decoupled Y throttle');
  });
});
