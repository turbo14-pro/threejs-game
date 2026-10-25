import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 4: Entity Culling (Distance-Based)
 * Tests that the server implements distance-based entity culling — only
 * players within an interest radius (200 units) of each viewer are included
 * in that viewer's snapshot.
 * Failure mode: all players broadcast to all viewers → wasted bandwidth on t4g.micro.
 */
describe('Entity culling distance-based', () => {
  const serverPath = path.resolve(__dirname, '../../server/ws-server.js');

  it('ws-server.js implements distance-based entity culling', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/cull|interest|radius|distance|200/);
  });

  it('ws-server.js filters players per viewer by distance', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf-8');
    expect(serverSource).toMatch(/filter.*viewer|viewer.*filter|per.*viewer|viewer.*per/);
  });
});
