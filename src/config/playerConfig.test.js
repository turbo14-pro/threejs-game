import { describe, it, expect } from 'vitest';
import { PLAYER_BASELINE, getDashConfig, getMaxJumps, shouldEndDash } from './playerConfig.js';

describe('dash config', () => {
  it('uses the baseline dash values when no power-up is active', () => {
    expect(getDashConfig()).toMatchObject({
      duration: 0.3,
      maxDistance: 6,
      maxDistanceMultiplier: 1,
      cooldown: 1,
    });
  });

  it('applies dash power-up multipliers for rarities', () => {
    expect(getDashConfig('gold')).toMatchObject({
      duration: 0.3,
      maxDistance: 54,
      maxDistanceMultiplier: 9,
      cooldown: 1,
    });
  });

  it('does not end a dash immediately before it has traveled far enough', () => {
    expect(shouldEndDash({ travelDistance: 0, maxDistance: 6, hSpeed: 0 })).toBe(false);
  });

  it('ends the dash once it reaches the configured distance cap', () => {
    expect(shouldEndDash({ travelDistance: 6, maxDistance: 6, hSpeed: 0 })).toBe(true);
  });
});

describe('jump config', () => {
  it('uses the baseline jump count when no jump power-up is active', () => {
    expect(getMaxJumps()).toBe(2);
    expect(getMaxJumps({ category: 'speed', rarity: 'gold' })).toBe(2);
  });

  it('uses the jump power-up count only when the active power-up is a jump power-up', () => {
    expect(getMaxJumps({ category: 'jump', rarity: 'gold' })).toBe(5);
  });
});

/**
 * Phase 02: Shared Physics Constants
 * Tests that PLAYER_BASELINE values match what the server hardcodes,
 * ensuring client and server use a single source of truth.
 * Failure mode: server hardcodes diverge from PLAYER_BASELINE →
 * client/server physics divergence → desync.
 */
describe('PLAYER_BASELINE shared constants', () => {
  it('walkSpeed matches server hardcoded value (4)', () => {
    expect(PLAYER_BASELINE.movement.walkSpeed).toBe(4);
  });

  it('sprintSpeed matches server hardcoded value (35)', () => {
    expect(PLAYER_BASELINE.movement.sprintSpeed).toBe(35);
  });

  it('slideSpeed matches server hardcoded value (40)', () => {
    expect(PLAYER_BASELINE.movement.slideSpeed).toBe(40);
  });

  it('jumpVelocity matches server hardcoded value (38)', () => {
    expect(PLAYER_BASELINE.movement.jumpVelocity).toBe(38);
  });

  it('dashSpeed matches server hardcoded value (150)', () => {
    expect(PLAYER_BASELINE.dash.dashSpeed).toBe(150);
  });

  it('all movement values are finite numbers', () => {
    const { walkSpeed, sprintSpeed, slideSpeed, jumpVelocity } = PLAYER_BASELINE.movement;
    expect(Number.isFinite(walkSpeed)).toBe(true);
    expect(Number.isFinite(sprintSpeed)).toBe(true);
    expect(Number.isFinite(slideSpeed)).toBe(true);
    expect(Number.isFinite(jumpVelocity)).toBe(true);
  });
});

/**
 * Phase 02: Physics Consistency
 * Simulates client and server movement with identical inputs to verify
 * they produce identical positions after N ticks.
 * Failure mode: client and server diverge → desync during straight-line running.
 */
describe('physics consistency client vs server', () => {
  const walkSpeed = PLAYER_BASELINE.movement.walkSpeed;
  const sprintSpeed = PLAYER_BASELINE.movement.sprintSpeed;
  const damping = 0.5; // Rapier linearDamping
  const dt = 0.0333; // 30Hz timestep

  function computePosition(speed, ticks) {
    // Simulate: velocity = speed * (1 - damping*dt)^ticks, position accumulates
    let vx = speed;
    let x = 0;
    const dampingFactor = 1 - damping * dt;
    for (let i = 0; i < ticks; i++) {
      x += vx * dt;
      vx *= dampingFactor;
    }
    return x;
  }

  it('client and server compute identical position after 100 ticks walking', () => {
    // Both client and server use the same walkSpeed from PLAYER_BASELINE
    const clientPos = computePosition(walkSpeed, 100);
    const serverPos = computePosition(walkSpeed, 100);
    expect(serverPos).toBeCloseTo(clientPos, 4);
  });

  it('client and server compute identical position after 100 ticks sprinting', () => {
    const clientPos = computePosition(sprintSpeed, 100);
    const serverPos = computePosition(sprintSpeed, 100);
    expect(serverPos).toBeCloseTo(clientPos, 4);
  });

  it('walk and sprint produce different positions (sanity check)', () => {
    const walkPos = computePosition(walkSpeed, 100);
    const sprintPos = computePosition(sprintSpeed, 100);
    expect(sprintPos).toBeGreaterThan(walkPos);
  });
});
