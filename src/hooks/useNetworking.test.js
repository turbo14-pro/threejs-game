import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Phase B: WS Binary Migration — Batch B5
 * Tests that the client networking hook uses WebSocket + msgpackr
 * instead of Geckos.io for the binary protocol migration.
 * Failure mode: client still uses Geckos, not wired to WS binary server.
 */
describe('Client WS Binary Migration', () => {
  const networkingPath = path.resolve(__dirname, '../hooks/useNetworking.js');

  it('useNetworking.js imports WebSocket instead of geckos', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).not.toContain('@geckos.io/client');
    expect(source).toContain('WebSocket');
  });

  it('useNetworking.js uses msgpackr for binary encoding', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).toContain('msgpackr');
  });

  it('useNetworking.js connects to WS URL (ws:// or wss://)', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).toMatch(/ws:\/\//);
  });

  it('useNetworking.js sends input as binary msgpackr message', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).toMatch(/send\(.*binary|binary.*send|encodeMessage|encodeInput/);
  });

  it('useNetworking.js decodes snapshot from binary message', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    expect(source).toMatch(/decodeMessage|decodeSnapshot|decode\(/);
  });
});
