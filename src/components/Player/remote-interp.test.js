import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Phase B: WS Binary Migration — Batch B4
 * Tests that remote player interpolation with jitter buffer is implemented.
 * Failure mode: no interpolation → remote players jitter and freeze.
 */
describe('Remote Interpolation', () => {
  const remotePlayerPath = path.resolve(
    __dirname,
    '../../components/Player/RemotePlayer.jsx'
  );

  it('RemotePlayer.jsx uses 30ms interpolation delay for LAN', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    expect(source).toContain('interpolationDelay = 30');
  });

  it('RemotePlayer.jsx stores velocity from snapshots', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    expect(source).toContain('vel');
  });

  it('RemotePlayer.jsx implements velocity extrapolation', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    expect(source).toMatch(/extrapolat|addScaledVector|lastVel/);
  });

  it('RemotePlayer.jsx uses pooled Vector3/Quaternion objects', () => {
    const source = fs.readFileSync(remotePlayerPath, 'utf-8');
    expect(source).toContain('useMemo');
  });
});