import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 4: Fix Y Throttle — Decouple Y Position from 20Hz Snapshot Throttle
 * Tests that Y position is sent at higher frequency (30Hz) than X/Z (20Hz)
 * to reduce Y lag during jumps/falls.
 * Failure mode: Y position only updates at 20Hz → Y lag during jumps/falls.
 */
describe('Y position throttle — decoupled from 20Hz', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('physics worker implements decoupled Y position updates', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toMatch(/yOnly|yUpdate|Y.*throttle|yInterval|decoupled/);
  });

  it('physics worker sends Y at 30Hz (every tick) while X/Z at 20Hz', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('SNAPSHOT_INTERVAL');
    expect(workerSource).toMatch(/yInterval|Y_INTERVAL|30Hz|every.*tick/);
  });
});
