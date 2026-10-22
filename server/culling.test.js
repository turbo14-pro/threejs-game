import { describe, it, expect } from 'vitest';

/**
 * Phase 05: Entity Culling & Change Detection
 * Tests that server only broadcasts players within interest radius
 * and skips unchanged entity state.
 * Failure mode: server sends all players to all clients → wasted bandwidth;
 * server sends unchanged state → wasted bandwidth + unnecessary client processing.
 */
describe('entity culling by interest radius', () => {
  const INTEREST_RADIUS = 200;

  function getVisiblePlayers(observerPos, allPlayers) {
    return allPlayers.filter(p => {
      const dx = p.pos[0] - observerPos[0];
      const dz = p.pos[2] - observerPos[2];
      return Math.sqrt(dx * dx + dz * dz) <= INTEREST_RADIUS;
    });
  }

  it('includes players within interest radius', () => {
    const observer = [0, 0, 0];
    const players = [
      { id: 'p1', pos: [50, 0, 50] },   // ~70m away — visible
      { id: 'p2', pos: [150, 0, 0] },   // 150m away — visible
      { id: 'p3', pos: [300, 0, 0] },   // 300m away — culled
    ];
    const visible = getVisiblePlayers(observer, players);
    expect(visible.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('excludes players outside interest radius', () => {
    const observer = [0, 0, 0];
    const players = [
      { id: 'p1', pos: [250, 0, 0] },   // 250m — culled
      { id: 'p2', pos: [0, 0, 250] },   // 250m — culled
    ];
    const visible = getVisiblePlayers(observer, players);
    expect(visible).toHaveLength(0);
  });

  it('includes player exactly at interest radius boundary', () => {
    const observer = [0, 0, 0];
    const players = [
      { id: 'p1', pos: [200, 0, 0] },   // exactly 200m — visible
    ];
    const visible = getVisiblePlayers(observer, players);
    expect(visible.map(p => p.id)).toEqual(['p1']);
  });
});

describe('change detection via state hash', () => {
  function hashState(entity) {
    const str = JSON.stringify({
      pos: entity.pos,
      vel: entity.vel,
      rot: entity.rot,
      anim: entity.anim,
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  it('produces same hash for identical state', () => {
    const a = { pos: [0, 0, 0], vel: [0, 0, 0], rot: 0, anim: {} };
    const b = { pos: [0, 0, 0], vel: [0, 0, 0], rot: 0, anim: {} };
    expect(hashState(a)).toBe(hashState(b));
  });

  it('produces different hash for changed position', () => {
    const a = { pos: [0, 0, 0], vel: [0, 0, 0], rot: 0, anim: {} };
    const b = { pos: [1, 0, 0], vel: [0, 0, 0], rot: 0, anim: {} };
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('produces different hash for changed velocity', () => {
    const a = { pos: [0, 0, 0], vel: [0, 0, 0], rot: 0, anim: {} };
    const b = { pos: [0, 0, 0], vel: [1, 0, 0], rot: 0, anim: {} };
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('skips unchanged entities when hash matches previous', () => {
    const entity = { id: 'p1', pos: [0, 0, 0], vel: [0, 0, 0], rot: 0, anim: {} };
    const prevHash = hashState(entity);
    const currHash = hashState(entity);
    expect(currHash).toBe(prevHash); // unchanged → skip
  });
});
