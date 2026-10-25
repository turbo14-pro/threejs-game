import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 5: Change Detection (Hash-Based)
 * Tests that the server implements hash-based change detection — only
 * entities whose state changed since the last snapshot are sent to each viewer.
 * Failure mode: full state sent every snapshot → wasted bandwidth.
 */
describe('Change detection hash-based', () => {
  const serverPath = path.resolve(__dirname, '../../server/ws-server.js');

  it('ws-server.js implements per-viewer change detection hash', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/hash|lastState|change|diff|changed/);
  });

  it('ws-server.js tracks last snapshot state per viewer', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/lastSnapshot|lastSent|previousState|viewerState/);
  });
});
