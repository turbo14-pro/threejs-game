/**
 * NetworkedEntityFactory — centralized entity creation with network ID assignment.
 * Creates NetworkedActor instances and tracks them in a registry keyed by network ID.
 * Used by both client and server for consistent entity creation.
 */
import { NetworkedActor } from './networkedActor.js';

const ENTITY_TYPES = new Set(['player', 'bot', 'obstacle', 'powerup']);

export class NetworkedEntityFactory {
  constructor() {
    this.entities = new Map(); // networkId -> NetworkedActor
  }

  /**
   * Create a new networked entity.
   * @param {string} type - Entity type ('player', 'bot', 'obstacle', 'powerup')
   * @param {string} networkId - Unique network identifier
   * @param {Object} position - { x, y, z }
   * @param {number} rotation - yaw in radians
   * @param {string} skin - character skin identifier
   * @returns {NetworkedActor}
   */
  create(type, networkId, position = { x: 0, y: 0, z: 0 }, rotation = 0, skin = 'avo') {
    if (!ENTITY_TYPES.has(type)) {
      throw new Error(`Unknown entity type: ${type}`);
    }
    if (this.entities.has(networkId)) {
      throw new Error(`Entity already exists with networkId: ${networkId}`);
    }

    const entity = new NetworkedActor(networkId, position, rotation, skin);
    entity.type = type;
    this.entities.set(networkId, entity);
    return entity;
  }

  /**
   * Create an entity from network snapshot data.
   * @param {Object} data - { id, pos, rot, skin, vel, lastProcessedSeq, ... }
   * @returns {NetworkedActor}
   */
  createFromNetwork(data) {
    const entity = this.create(
      data.type || 'player',
      data.id,
      { x: data.pos?.[0] ?? 0, y: data.pos?.[1] ?? 0, z: data.pos?.[2] ?? 0 },
      data.rot ?? 0,
      data.skin ?? 'avo'
    );
    if (data.vel) {
      entity.velocity = [...data.vel];
    }
    if (data.lastProcessedSeq !== undefined) {
      entity.lastProcessedSeq = data.lastProcessedSeq;
    }
    return entity;
  }

  /**
   * Retrieve an entity by network ID.
   * @param {string} networkId
   * @returns {NetworkedActor | undefined}
   */
  getEntity(networkId) {
    return this.entities.get(networkId);
  }

  /**
   * Get the number of tracked entities.
   * @returns {number}
   */
  getEntityCount() {
    return this.entities.size;
  }

  /**
   * Remove an entity from the registry.
   * @param {string} networkId
   * @returns {boolean} true if removed
   */
  remove(networkId) {
    return this.entities.delete(networkId);
  }

  /**
   * Get all tracked entities.
   * @returns {NetworkedActor[]}
   */
  getAllEntities() {
    return Array.from(this.entities.values());
  }
}
