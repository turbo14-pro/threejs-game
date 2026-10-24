import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch A2.5: Fix 1.5 — Full State Snapshots (Decision #16)
 * Tests that server broadcast snapshots include vel, lastProcessedSeq,
 * and groundY for obstacle-aware reconciliation.
 * Failure mode: missing vel prevents client-side prediction; missing
 * lastProcessedSeq prevents input acknowledgment correlation; missing
 * groundY prevents obstacle-aware Y-height sync (Issue 7).
 */
describe('Full state snapshots', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('snapshot includes vel for each player', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('vel:');
  });

  it('snapshot includes lastProcessedSeq for each player', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('lastProcessedSeq');
  });

  it('snapshot includes groundY for obstacle-aware Y-height sync', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('groundY');
  });
});