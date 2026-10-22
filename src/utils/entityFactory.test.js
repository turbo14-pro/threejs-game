import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkedEntityFactory } from './entityFactory.js';

/**
 * Phase 08: Entity Factory
 * Tests that NetworkedEntityFactory centralizes entity creation with
 * network ID assignment and registry tracking.
 * Failure mode: entities created without network IDs → cannot sync
 * over network → desync and missing remote players.
 */
describe('NetworkedEntityFactory creation', () => {
  let factory;

  beforeEach(() => {
    factory = new NetworkedEntityFactory();
  });

  it('creates a player entity with network ID', () => {
    const entity = factory.create('player', 'net-1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    expect(entity.id).toBe('net-1');
    expect(entity.position).toEqual({ x: 0, y: 100, z: 0 });
    expect(entity.rotation).toBe(0);
    expect(entity.skin).toBe('avo');
    expect(entity.type).toBe('player');
  });

  it('creates from network data', () => {
    const entity = factory.createFromNetwork({
      id: 'net-2',
      pos: [10, 100, 20],
      rot: Math.PI / 2,
      skin: 'skin_b',
      vel: [1, 0, 0],
      lastProcessedSeq: 5,
    });
    expect(entity.id).toBe('net-2');
    expect(entity.position).toEqual({ x: 10, y: 100, z: 20 });
    expect(entity.rotation).toBe(Math.PI / 2);
    expect(entity.skin).toBe('skin_b');
    expect(entity.velocity).toEqual([1, 0, 0]);
    expect(entity.lastProcessedSeq).toBe(5);
  });

  it('tracks created entities in registry', () => {
    factory.create('player', 'net-1', { x: 0, y: 0, z: 0 }, 0, 'avo');
    factory.create('player', 'net-2', { x: 10, y: 0, z: 0 }, 0, 'avo');
    expect(factory.getEntityCount()).toBe(2);
  });

  it('retrieves entity by network ID', () => {
    const entity = factory.create('player', 'net-1', { x: 0, y: 0, z: 0 }, 0, 'avo');
    const retrieved = factory.getEntity('net-1');
    expect(retrieved).toBe(entity);
  });

  it('returns undefined for unknown network ID', () => {
    expect(factory.getEntity('nonexistent')).toBeUndefined();
  });

  it('removes entity from registry', () => {
    factory.create('player', 'net-1', { x: 0, y: 0, z: 0 }, 0, 'avo');
    factory.remove('net-1');
    expect(factory.getEntity('net-1')).toBeUndefined();
    expect(factory.getEntityCount()).toBe(0);
  });

  it('throws on unknown entity type', () => {
    expect(() => factory.create('unknown', 'net-1', { x: 0, y: 0, z: 0 }, 0, 'avo')).toThrow();
  });
});
