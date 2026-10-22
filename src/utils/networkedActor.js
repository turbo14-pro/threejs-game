/**
 * NetworkedActor — shared base class for networked entities.
 * Standardizes state management between client RemotePlayer and server Player.
 * Pure JS — no Three.js or Rapier dependencies.
 */
export class NetworkedActor {
  /**
   * @param {string} id - Unique entity identifier
   * @param {Object} position - { x, y, z } world position
   * @param {number} rotation - yaw in radians
   * @param {string} skin - character skin identifier
   */
  constructor(id, position = { x: 0, y: 0, z: 0 }, rotation = 0, skin = 'avo') {
    this.id = id;
    this.position = { ...position };
    this.rotation = rotation;
    this.skin = skin;
    this.velocity = [0, 0, 0];
    this.lastProcessedSeq = undefined;
    this.lastStateHash = null;
    this.lastSeen = Date.now();
  }

  /**
   * Update actor state from a server snapshot.
   * @param {Object} state - { pos, rot, skin, vel, tick, lastProcessedSeq }
   */
  updateState(state) {
    if (state.pos) {
      this.position = {
        x: Number.isFinite(state.pos[0]) ? state.pos[0] : 0,
        y: Number.isFinite(state.pos[1]) ? state.pos[1] : 0,
        z: Number.isFinite(state.pos[2]) ? state.pos[2] : 0,
      };
    }
    if (state.rot !== undefined) {
      this.rotation = Number.isFinite(state.rot) ? state.rot : 0;
    }
    if (state.skin !== undefined) {
      this.skin = state.skin;
    }
    if (state.vel) {
      this.velocity = [
        Number.isFinite(state.vel[0]) ? state.vel[0] : 0,
        Number.isFinite(state.vel[1]) ? state.vel[1] : 0,
        Number.isFinite(state.vel[2]) ? state.vel[2] : 0,
      ];
    }
    if (state.lastProcessedSeq !== undefined) {
      this.lastProcessedSeq = state.lastProcessedSeq;
    }
    this.lastSeen = Date.now();
  }

  /**
   * Compute a hash of the current state for change detection.
   * @returns {number} hash value
   */
  computeStateHash() {
    const str = JSON.stringify({
      pos: [this.position.x, this.position.y, this.position.z],
      vel: this.velocity,
      rot: this.rotation,
      anim: this.anim || {},
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Check if state has changed since last hash.
   * @returns {boolean} true if state changed
   */
  hasStateChanged() {
    const hash = this.computeStateHash();
    if (hash === this.lastStateHash) return false;
    this.lastStateHash = hash;
    return true;
  }
}
