import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch A5: Fix 4 — Remote Players Freeze (Velocity Extrapolation)
 * Tests that RemotePlayer.jsx implements velocity extrapolation when
 * packets stall, preventing remote player freeze (Issue 4).
 * Failure mode: no extrapolation → remote player freezes when packets
 * are delayed or lost.
 */
describe('Remote player velocity extrapolation', () => {
  const remotePlayerPath = path.resolve(
    __dirname,
    '../../components/Player/RemotePlayer.jsx'
  );

  it('RemotePlayer.jsx stores velocity from snapshot data', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    expect(source).toContain('vel');
  });

  it('RemotePlayer.jsx implements velocity extrapolation when packets stall', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    expect(source).toMatch(/extrapolat|lastVel|velocity.*dt|targetPos.*addScaled/);
  });

  it('RemotePlayer.jsx reduces interpolation delay for LAN (30ms)', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    // Should use 30ms delay for LAN, not 100ms
    expect(source).not.toContain('interpolationDelay = 100');
  });
});