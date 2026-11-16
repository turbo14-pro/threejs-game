import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deriveWsUrl } from '../config/envConfig.js';

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

  it('useNetworking.js delegates WS URL derivation to central envConfig', () => {
    const source = fs.readFileSync(networkingPath, 'utf-8');
    // No inline URL munging — the hook must use the central config module
    expect(source).not.toContain('baseAddress');
    expect(source).not.toContain(':9208');
    expect(source).toContain('getServerConfig');
    // envConfig itself derives proper schemes: ws:// in dev (default port 9208), wss:// in prod
    expect(deriveWsUrl('http://192.168.1.66:9208', true)).toBe('ws://192.168.1.66:9208');
    expect(deriveWsUrl('http://192.168.1.66', true)).toBe('ws://192.168.1.66:9208');
    expect(deriveWsUrl('https://turbogames.duckdns.org', false)).toBe('wss://turbogames.duckdns.org');
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
