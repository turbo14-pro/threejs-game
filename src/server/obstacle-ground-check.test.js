import { describe, it, expect } from 'vitest';
import { isGrounded, getGroundY } from '../utils/baseGame.js';

/**
 * Batch A8: Fix 7 — Obstacle-Aware Ground Check
 * Tests that server isGrounded() checks obstacle surfaces, not just floor.
 * Failure mode: server thinks player is at y=2.5 even when standing on
 * an obstacle → remote player animates through obstacle (Issue 7).
 */
describe('Obstacle-aware ground check', () => {
  const obstacles = [
    { x: 0, y: 18, z: 0, w: 30, h: 36, d: 12 }, // Box top at y=36
    { x: 50, y: 0, z: 50, w: 30, h: 36, d: 12 }, // Box top at y=18
  ];

  it('returns true when on floor (y <= 5.5)', () => {
    expect(isGrounded({ x: 0, y: 0, z: 0 }, obstacles)).toBe(true);
    expect(isGrounded({ x: 0, y: 5.5, z: 0 }, obstacles)).toBe(true);
  });

  it('returns true when on platform (y ~ 100)', () => {
    expect(isGrounded({ x: 0, y: 100, z: 0 }, obstacles)).toBe(true);
  });

  it('returns true when standing on obstacle top', () => {
    // Player capsule bottom at y - 1.5; standing on box top at y=36
    // So player center y should be ~36 + 1.5 = 37.5
    expect(isGrounded({ x: 0, y: 37.5, z: 0 }, obstacles)).toBe(true);
  });

  it('returns false when in air above obstacle', () => {
    expect(isGrounded({ x: 0, y: 50, z: 0 }, obstacles)).toBe(false);
  });

  it('returns false when horizontally outside obstacle', () => {
    expect(isGrounded({ x: 100, y: 37.5, z: 0 }, obstacles)).toBe(false);
  });

  it('getGroundY returns obstacle top Y when standing on it', () => {
    expect(getGroundY({ x: 0, y: 37.5, z: 0 }, obstacles)).toBe(36);
  });

  it('getGroundY returns 0 for floor', () => {
    expect(getGroundY({ x: 0, y: 0, z: 0 }, obstacles)).toBe(0);
  });

  it('getGroundY returns -1 when airborne', () => {
    expect(getGroundY({ x: 0, y: 50, z: 0 }, obstacles)).toBe(-1);
  });
});