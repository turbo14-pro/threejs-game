import { describe, it, expect } from 'vitest';
import { NetworkedActor } from './networkedActor.js';

/**
 * Phase 07: NetworkedActor Base Class
 * Tests that NetworkedActor standardizes networked entity behavior
 * shared between client RemotePlayer and server Player.
 * Failure mode: client and server diverge on entity state handling →
 * desync and inconsistent remote player rendering.
 */
describe('NetworkedActor state management', () => {
  it('stores id, position, rotation, and skin', () => {
    const actor = new NetworkedActor('p1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    expect(actor.id).toBe('p1');
    expect(actor.position).toEqual({ x: 0, y: 100, z: 0 });
    expect(actor.rotation).toBe(0);
    expect(actor.skin).toBe('avo');
  });

  it('updates position from server snapshot', () => {
    const actor = new NetworkedActor('p1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    actor.updateState({ pos: [10, 100, 20], rot: Math.PI / 2, skin: 'avo' });
    expect(actor.position).toEqual({ x: 10, y: 100, z: 20 });
    expect(actor.rotation).toBe(Math.PI / 2);
  });

  it('updates velocity from server snapshot', () => {
    const actor = new NetworkedActor('p1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    actor.updateState({ pos: [0, 100, 0], rot: 0, skin: 'avo', vel: [5, 0, -3] });
    expect(actor.velocity).toEqual([5, 0, -3]);
  });

  it('tracks lastProcessedSeq for acknowledgment matching', () => {
    const actor = new NetworkedActor('p1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    expect(actor.lastProcessedSeq).toBeUndefined();
    actor.updateState({ pos: [0, 100, 0], rot: 0, skin: 'avo', lastProcessedSeq: 7 });
    expect(actor.lastProcessedSeq).toBe(7);
  });

  it('computes state hash for change detection', () => {
    const actor = new NetworkedActor('p1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    const hash1 = actor.computeStateHash();
    actor.updateState({ pos: [10, 100, 0], rot: 0, skin: 'avo' });
    const hash2 = actor.computeStateHash();
    expect(hash1).not.toBe(hash2);
  });

  it('returns same hash for unchanged state', () => {
    const actor = new NetworkedActor('p1', { x: 0, y: 100, z: 0 }, 0, 'avo');
    const hash1 = actor.computeStateHash();
    const hash2 = actor.computeStateHash();
    expect(hash1).toBe(hash2);
  });
});

describe('NetworkedActor is shared between client and server', () => {
  it('can be instantiated without Three.js or Rapier dependencies', () => {
    // Pure JS — no DOM, no physics engine required
    const actor = new NetworkedActor('test', { x: 0, y: 0, z: 0 }, 0, 'skin');
    expect(actor).toBeInstanceOf(NetworkedActor);
  });
});
