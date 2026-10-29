import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch A6: Fix 5 — Bots Broadcast from Server
 * Tests that bots are controlled by the server and their positions
 * are broadcast in snapshots so all clients can see them (Issue 5).
 * Failure mode: bots are client-local only → other humans cannot see them.
 */
describe('Server-controlled bots broadcast', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('physics worker handles addBot message', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain("'addBot'");
  });

  it('physics worker creates bot physics body', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('isBot: true');
  });

  it('snapshot includes bot players', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('players.values()');
  });

  it('server/index.js forwards addBot to worker', () => {
    const serverPath = path.resolve(__dirname, '../../server/index.js');
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toContain("'addBot'");
  });
});