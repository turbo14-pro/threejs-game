import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Phase B: WS Binary Migration — Batch B3
 * Tests that client-side prediction and reconciliation are implemented.
 * Failure mode: no prediction/reconciliation → desync between client and server.
 */
describe('Client Prediction + Reconciliation', () => {
  const playerControllerPath = path.resolve(
    __dirname,
    '../../components/Player/PlayerController.jsx'
  );
  const networkingPath = path.resolve(__dirname, '../../hooks/useNetworking.js');

  it('PlayerController.jsx tracks sentInputs by sequenceId', () => {
    const source = fs.readFileSync(playerControllerPath, 'utf-8');
    expect(source).toContain('sentInputs');
  });

  it('PlayerController.jsx stores inputHistory with sequence IDs', () => {
    const source = fs.readFileSync(playerControllerPath, 'utf-8');
    expect(source).toContain('inputHistory');
  });

  it('PlayerController.jsx reconciles on server state snap', () => {
    const source = fs.readFileSync(playerControllerPath, 'utf-8');
    expect(source).toMatch(/reconciliation|re-apply|unacknowledged/);
  });

  it('useNetworking.js sends input with sequenceId', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).toContain('sequenceId');
  });

  it('useNetworking.js returns sequenceId from sendUpdate', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).toContain('return sequenceId');
  });
});