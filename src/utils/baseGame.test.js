import { describe, it, expect } from 'vitest';
import {
  computeVelocity,
  isGrounded,
  PLAYER_BASELINE as baseGamePlayerBaseline,
} from './baseGame.js';
import { PLAYER_BASELINE } from '../config/playerConfig.js';

/**
 * Phase 06: Shared Codebase (BaseGame)
 * Tests that BaseGame produces identical results on client and server,
 * eliminating physics divergence.
 * Failure mode: client and server compute different velocities for
 * identical input → desync during movement.
 */
describe('BaseGame movement velocity', () => {
  const walkSpeed = 4;
  const sprintSpeed = 35;

  it('computes walking velocity from input + camRot', () => {
    const { vx, vz } = computeVelocity(
      { w: true, a: false, s: false, d: false },
      0, // camRot
      walkSpeed
    );
    // Moving forward (w) with camRot=0 → negative Z
    expect(vx).toBeCloseTo(0, 4);
    expect(vz).toBeCloseTo(-walkSpeed, 4);
  });

  it('computes sprinting velocity from input + camRot', () => {
    const { vx, vz } = computeVelocity(
      { w: true, a: false, s: false, d: false },
      0,
      sprintSpeed
    );
    expect(vx).toBeCloseTo(0, 4);
    expect(vz).toBeCloseTo(-sprintSpeed, 4);
  });

  it('rotates velocity by camRot', () => {
    const { vx, vz } = computeVelocity(
      { w: true, a: false, s: false, d: false },
      Math.PI / 2, // 90 degrees right
      walkSpeed
    );
    // Forward rotated 90° → negative X (per applyAxisAngle convention)
    expect(vx).toBeCloseTo(-walkSpeed, 4);
    expect(vz).toBeCloseTo(0, 4);
  });

  it('returns zero velocity when no input', () => {
    const { vx, vz } = computeVelocity(
      { w: false, a: false, s: false, d: false },
      0,
      walkSpeed
    );
    expect(vx).toBe(0);
    expect(vz).toBe(0);
  });

  it('normalizes diagonal input', () => {
    const { vx, vz } = computeVelocity(
      { w: true, a: false, s: false, d: true },
      0,
      walkSpeed
    );
    // Diagonal (w+d) should have length == walkSpeed
    const len = Math.sqrt(vx * vx + vz * vz);
    expect(len).toBeCloseTo(walkSpeed, 4);
  });
});

describe('BaseGame ground check', () => {
  it('returns true when on ground (y <= 5.5)', () => {
    expect(isGrounded({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(isGrounded({ x: 0, y: 5.5, z: 0 })).toBe(true);
  });

  it('returns true on platform (y ~ 100)', () => {
    expect(isGrounded({ x: 0, y: 100, z: 0 })).toBe(true);
  });

  it('returns false when in air', () => {
    expect(isGrounded({ x: 0, y: 10, z: 0 })).toBe(false);
    expect(isGrounded({ x: 0, y: 50, z: 0 })).toBe(false);
  });
});

describe('BaseGame is shared between client and server', () => {
  it('exports the same PLAYER_BASELINE values as playerConfig', () => {
    expect(baseGamePlayerBaseline.movement.walkSpeed).toBe(PLAYER_BASELINE.movement.walkSpeed);
    expect(baseGamePlayerBaseline.movement.sprintSpeed).toBe(PLAYER_BASELINE.movement.sprintSpeed);
    expect(baseGamePlayerBaseline.movement.jumpVelocity).toBe(PLAYER_BASELINE.movement.jumpVelocity);
  });
});
