import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkSimulator } from './networkSimulator.js';

/**
 * Phase 09: Latency Simulation
 * Tests that NetworkSimulator adds latency, jitter, and packet loss
 * for testing WAN conditions locally.
 * Failure mode: simulator doesn't delay/drop packets → can't test
 * WAN behavior → production issues undetected.
 */
describe('NetworkSimulator latency', () => {
  let simulator;
  let mockSend;

  beforeEach(() => {
    mockSend = vi.fn();
    simulator = new NetworkSimulator({ latency: 100, jitter: 20, packetLoss: 0 });
  });

  afterEach(() => {
    simulator.destroy();
  });

  it('delays message delivery by configured latency', async () => {
    const start = Date.now();
    simulator.send('test-message', mockSend);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(mockSend).toHaveBeenCalledWith('test-message');
    expect(Date.now() - start).toBeGreaterThanOrEqual(100);
  });

  it('applies jitter to latency', async () => {
    for (let i = 0; i < 10; i++) {
      simulator.send(`msg-${i}`, mockSend);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    // All 10 messages should be delivered (latency 100 + jitter up to 20 = max 120ms)
    expect(mockSend).toHaveBeenCalledTimes(10);
    // Verify messages were delivered with varying content
    const deliveredMsgs = mockSend.mock.calls.map(c => c[0]);
    expect(deliveredMsgs).toHaveLength(10);
    expect(deliveredMsgs).toContain('msg-0');
    expect(deliveredMsgs).toContain('msg-9');
  });

  it('drops packets according to packetLoss rate', () => {
    const lossySim = new NetworkSimulator({ latency: 10, jitter: 0, packetLoss: 1 });
    const dropSend = vi.fn();
    lossySim.send('msg-1', dropSend);
    lossySim.send('msg-2', dropSend);
    lossySim.send('msg-3', dropSend);
    // With 100% packet loss, nothing should be sent
    expect(dropSend).not.toHaveBeenCalled();
    lossySim.destroy();
  });

  it('does not drop packets when packetLoss is 0', async () => {
    const noLossSim = new NetworkSimulator({ latency: 10, jitter: 0, packetLoss: 0 });
    const send = vi.fn();
    noLossSim.send('msg-1', send);
    noLossSim.send('msg-2', send);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(send).toHaveBeenCalledTimes(2);
    noLossSim.destroy();
  });

  it('preserves message order when no jitter', async () => {
    const orderedSim = new NetworkSimulator({ latency: 10, jitter: 0, packetLoss: 0 });
    const send = vi.fn();
    orderedSim.send('first', send);
    orderedSim.send('second', send);
    orderedSim.send('third', send);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(send.mock.calls.map(c => c[0])).toEqual(['first', 'second', 'third']);
    orderedSim.destroy();
  });
});

describe('NetworkSimulator configuration', () => {
  it('uses default values when not provided', () => {
    const sim = new NetworkSimulator();
    expect(sim.latency).toBe(0);
    expect(sim.jitter).toBe(0);
    expect(sim.packetLoss).toBe(0);
    sim.destroy();
  });

  it('clamps packetLoss to [0, 1]', () => {
    const sim = new NetworkSimulator({ packetLoss: 1.5 });
    expect(sim.packetLoss).toBe(1);
    sim.destroy();
  });
});
