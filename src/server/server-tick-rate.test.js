import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch A1: Fix 0 — Server Jitter (Worker Thread + 30Hz Sim)
 * Tests that the physics worker runs at 30Hz (33.33ms per tick),
 * matching the client/server Rapier timestep.
 * Failure mode: worker runs at 60Hz (16.66ms) → doubles CPU on Oracle micro
 * with limited gain, contradicting confirmed Decision Gap #2.
 */
describe('Server tick rate consistency', () => {
  let originalSetInterval;
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  beforeEach(() => {
    originalSetInterval = global.setInterval;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.setInterval = originalSetInterval;
  });

  it('physics worker uses 30Hz simulation rate (33.33ms per tick)', async () => {
    // The physics-worker.js sets SIMULATION_RATE = 1000 / 30 for 30Hz
    // Verify the constant is 33.33ms, not 16.66ms (60Hz)
    const expectedRate = 1000 / 30; // 33.33ms
    const sixtyHzRate = 1000 / 60; // 16.66ms

    // Read the source to verify the rate
    const workerSource = fs.readFileSync(workerPath, 'utf-8');

    // Should contain 30Hz rate, not 60Hz
    expect(workerSource).toContain('1000 / 30');
    expect(workerSource).not.toContain('1000 / 60');
    expect(expectedRate).toBeCloseTo(33.33, 1);
    expect(sixtyHzRate).toBeCloseTo(16.66, 1);
  });

  it('world timestep matches 30Hz (0.0333)', async () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');

    // Should set world.timestep to 1/30 or 0.0333, not 1/60
    expect(workerSource).toContain('1 / 30');
    expect(workerSource).not.toContain('1 / 60');
  });
});
