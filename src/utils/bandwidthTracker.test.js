import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BandwidthTracker } from './bandwidthTracker.js';

/**
 * Phase 10: Bandwidth Tracking
 * Tests that BandwidthTracker tracks per-client bytes sent/received
 * and computes bits-per-second rates.
 * Failure mode: no bandwidth tracking → cannot detect overwhelmed
 * clients → cannot adapt snapshot rate → connection drops.
 */
describe('BandwidthTracker byte counting', () => {
  let tracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new BandwidthTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
    tracker.destroy();
  });

  it('tracks bytes sent', () => {
    tracker.trackSent(100);
    tracker.trackSent(200);
    expect(tracker.getBytesSent()).toBe(300);
  });

  it('tracks bytes received', () => {
    tracker.trackReceived(50);
    tracker.trackReceived(75);
    expect(tracker.getBytesReceived()).toBe(125);
  });

  it('computes send rate in bits per second', () => {
    tracker.trackSent(1000); // 1000 bytes = 8000 bits
    // Advance time by 1 second
    vi.advanceTimersByTime(1000);
    const rate = tracker.getSendBps();
    expect(rate).toBeCloseTo(8000, 0);
  });

  it('computes receive rate in bits per second', () => {
    tracker.trackReceived(500); // 500 bytes = 4000 bits
    vi.advanceTimersByTime(1000);
    const rate = tracker.getReceiveBps();
    expect(rate).toBeCloseTo(4000, 0);
  });

  it('resets counters', () => {
    tracker.trackSent(100);
    tracker.trackReceived(50);
    tracker.reset();
    expect(tracker.getBytesSent()).toBe(0);
    expect(tracker.getBytesReceived()).toBe(0);
  });

  it('returns 0 rate when no data tracked', () => {
    expect(tracker.getSendBps()).toBe(0);
    expect(tracker.getReceiveBps()).toBe(0);
  });
});

describe('BandwidthTracker per-client isolation', () => {
  it('maintains separate counters per tracker instance', () => {
    const a = new BandwidthTracker();
    const b = new BandwidthTracker();
    a.trackSent(100);
    b.trackSent(200);
    expect(a.getBytesSent()).toBe(100);
    expect(b.getBytesSent()).toBe(200);
    a.destroy();
    b.destroy();
  });
});
