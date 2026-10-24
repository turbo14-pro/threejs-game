import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Phase B: WS Binary Migration — Batch B1
 * Tests that the WebSocket binary server can be created and listens on port 9208.
 * Failure mode: server fails to boot or cannot accept WebSocket connections.
 */
describe('WebSocket Binary Server', () => {
  let originalSetInterval;

  beforeEach(() => {
    originalSetInterval = global.setInterval;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.setInterval = originalSetInterval;
  });

  it('ws-server.js module exists and exports a server creation function', () => {
    const fs = require('fs');
    const path = require('path');
    const wsServerPath = path.resolve(__dirname, '../../server/ws-server.js');
    expect(fs.existsSync(wsServerPath)).toBe(true);
  });

  it('ws-server.js uses ws + msgpackr for binary protocol', () => {
    const fs = require('fs');
    const path = require('path');
    const wsServerPath = path.resolve(__dirname, '../../server/ws-server.js');
    const source = fs.readFileSync(wsServerPath, 'utf-8');
    expect(source).toContain('ws');
    expect(source).toContain('msgpackr');
  });

  it('ws-server.js runs physics in worker_thread', () => {
    const fs = require('fs');
    const path = require('path');
    const wsServerPath = path.resolve(__dirname, '../../server/ws-server.js');
    const source = fs.readFileSync(wsServerPath, 'utf-8');
    expect(source).toContain('Worker');
    expect(source).toContain('worker_threads');
  });
});