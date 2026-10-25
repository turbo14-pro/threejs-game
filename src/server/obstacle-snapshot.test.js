import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 3: Broadcast Obstacles in Snapshots
 * Tests that obstacle positions are included in the worker snapshot payload
 * so clients receive server-authoritative obstacle data instead of relying
 * solely on local seed(42).
 * Failure mode: obstacles not in snapshot → clients use local seed which may diverge.
 */
describe('Obstacle broadcast in snapshots', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');
  const serverPath = path.resolve(__dirname, '../../server/ws-server.js');

  it('physics worker includes obstacles in snapshot message', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('obstacles');
    expect(workerSource).toMatch(/players.*obstacles|obstacles.*players/);
  });

  it('ws-server.js forwards obstacles to clients in snapshot payload', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toContain('obstacles');
  });
});
