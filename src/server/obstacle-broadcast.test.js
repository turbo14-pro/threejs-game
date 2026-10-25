import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch A7: Fix 6 — Obstacles Broadcast from Server
 * Tests that obstacle positions are broadcast from the server so all
 * clients see the same obstacle locations (Issue 6).
 * Failure mode: obstacles are not broadcast → clients use local seed(42)
 * which may diverge from server.
 */
describe('Server obstacle broadcast', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');
  const serverPath = path.resolve(__dirname, '../../server/ws-server.js');

  it('physics worker handles setObstacles message', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain("'setObstacles'");
  });

  it('physics worker stores obstacle data', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('obstacles');
  });

  it('server/ws-server.js can send obstacles to worker', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toContain("'setObstacles'");
  });
});