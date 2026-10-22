/**
 * BandwidthTracker — per-client bandwidth metrics tracking.
 * Tracks bytes sent/received and computes bits-per-second rates.
 * Used by the server to adapt snapshot rate for slow clients.
 */
export class BandwidthTracker {
  constructor() {
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.startTime = Date.now();
    this.lastSent = 0;
    this.lastReceived = 0;
    this.lastTime = this.startTime;
  }

  /**
   * Track bytes sent.
   * @param {number} bytes
   */
  trackSent(bytes) {
    this.bytesSent += bytes;
    this.lastSent = this.bytesSent;
    this.lastTime = Date.now();
  }

  /**
   * Track bytes received.
   * @param {number} bytes
   */
  trackReceived(bytes) {
    this.bytesReceived += bytes;
    this.lastReceived = this.bytesReceived;
    this.lastTime = Date.now();
  }

  /**
   * Get total bytes sent.
   * @returns {number}
   */
  getBytesSent() {
    return this.bytesSent;
  }

  /**
   * Get total bytes received.
   * @returns {number}
   */
  getBytesReceived() {
    return this.bytesReceived;
  }

  /**
   * Get send rate in bits per second.
   * @returns {number}
   */
  getSendBps() {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    if (elapsed <= 0) return 0;
    return (this.bytesSent * 8) / elapsed;
  }

  /**
   * Get receive rate in bits per second.
   * @returns {number}
   */
  getReceiveBps() {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    if (elapsed <= 0) return 0;
    return (this.bytesReceived * 8) / elapsed;
  }

  /**
   * Reset all counters.
   */
  reset() {
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.startTime = Date.now();
    this.lastSent = 0;
    this.lastReceived = 0;
    this.lastTime = this.startTime;
  }

  /**
   * Destroy the tracker.
   */
  destroy() {
    this.reset();
  }
}
