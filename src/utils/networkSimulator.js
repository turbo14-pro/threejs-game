/**
 * NetworkSimulator — simulates network conditions for local WAN testing.
 * Adds latency, jitter, and packet loss to messages sent through it.
 * Used in debug mode to test multiplayer under realistic conditions.
 */
export class NetworkSimulator {
  /**
   * @param {Object} config - { latency, jitter, packetLoss }
   * @param {number} config.latency - base delay in ms (default 0)
   * @param {number} config.jitter - random variation in ms (default 0)
   * @param {number} config.packetLoss - probability of dropping [0,1] (default 0)
   */
  constructor({ latency = 0, jitter = 0, packetLoss = 0 } = {}) {
    this.latency = Math.max(0, latency);
    this.jitter = Math.max(0, jitter);
    this.packetLoss = Math.min(1, Math.max(0, packetLoss));
    this.pending = []; // { message, send, deliverAt }
    this.destroyed = false;
  }

  /**
   * Send a message through the simulator.
   * @param {any} message - The message to deliver
   * @param {Function} send - The actual send function to call after delay
   */
  send(message, send) {
    if (this.destroyed) return;

    // Packet loss
    if (Math.random() < this.packetLoss) return;

    const jitter = this.jitter > 0 ? Math.random() * this.jitter * 2 - this.jitter : 0;
    const deliverAt = Date.now() + this.latency + jitter;

    this.pending.push({ message, send, deliverAt });
    this._flush();
  }

  _flush() {
    if (this.destroyed) return;

    const now = Date.now();
    const ready = [];
    const remaining = [];

    for (const item of this.pending) {
      if (now >= item.deliverAt) {
        ready.push(item);
      } else {
        remaining.push(item);
      }
    }

    this.pending = remaining;

    for (const item of ready) {
      try {
        item.send(item.message);
      } catch {
        // Send failure — swallow to avoid crashing the simulator
      }
    }

    if (this.pending.length > 0 && !this.destroyed) {
      // Schedule next flush when the earliest message is due
      const nextDeliverAt = Math.min(...this.pending.map(p => p.deliverAt));
      const delay = Math.max(0, nextDeliverAt - Date.now());
      setTimeout(() => this._flush(), delay);
    }
  }

  /**
   * Get the number of pending (undelivered) messages.
   * @returns {number}
   */
  getPendingCount() {
    return this.pending.length;
  }

  /**
   * Destroy the simulator and clear pending messages.
   */
  destroy() {
    this.destroyed = true;
    this.pending = [];
  }
}
