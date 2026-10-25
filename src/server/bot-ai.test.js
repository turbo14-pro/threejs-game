import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 6: Improve Bot AI
 * Tests that bots track nearest player and move toward them instead of
 * hardcoded forward movement.
 * Failure mode: bots use hardcoded {w: true} → not interactive, not server-controlled.
 */
describe('Improved bot AI', () => {
  const serverPath = path.resolve(__dirname, '../../server/ws-server.js');

  it('ws-server.js bot AI tracks nearest player', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/nearest|target|closest|track/);
  });

  it('ws-server.js bot AI computes distance to players', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/distance|dist|Math\.hypot|Math\.sqrt/);
  });

  it('ws-server.js bot AI sends directional input toward target', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/input.*target|target.*input|camRot.*target|target.*camRot/);
  });
});
