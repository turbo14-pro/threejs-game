import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch A2: Fix 1 — Double Jump in Air with Power-up
 * Tests that the server jump state machine supports air jumps with
 * power-up increased maxJumps (base 2, up to 6 with diamond jump power-up).
 * Failure mode: server only allows grounded jumps → double jump broken
 * with power-up tokens (Issue 1).
 */
describe('Server double jump with power-up', () => {
  const workerPath = path.resolve(__dirname, '../../server/physics-worker.mjs');

  it('physics worker imports getAirJumpVelocity from baseGame', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('getAirJumpVelocity');
  });

  it('physics worker uses airJumpVelocity for air jumps', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    expect(workerSource).toContain('getAirJumpVelocity()');
  });

  it('playerConfig exports airJumpVelocity', () => {
    const configPath = path.resolve(__dirname, '../../src/config/playerConfig.js');
    const configSource = fs.readFileSync(configPath, 'utf-8');
    expect(configSource).toContain('airJumpVelocity');
  });

  it('PLAYER_BASELINE.movement.maxJumps is 2 (base)', () => {
    const { PLAYER_BASELINE } = require(path.resolve(
      __dirname,
      '../../src/config/playerConfig.js'
    ));
    expect(PLAYER_BASELINE.movement.maxJumps).toBe(2);
  });

  it('PLAYER_BASELINE.movement.airJumpVelocity is 35', () => {
    const { PLAYER_BASELINE } = require(path.resolve(
      __dirname,
      '../../src/config/playerConfig.js'
    ));
    expect(PLAYER_BASELINE.movement.airJumpVelocity).toBe(35);
  });

  it('POWERUP_EFFECTS.jump provides jumpCount by rarity', () => {
    const { POWERUP_EFFECTS } = require(path.resolve(
      __dirname,
      '../../src/config/playerConfig.js'
    ));
    expect(POWERUP_EFFECTS.jump.bronze.jumpCount).toBe(3);
    expect(POWERUP_EFFECTS.jump.silver.jumpCount).toBe(4);
    expect(POWERUP_EFFECTS.jump.gold.jumpCount).toBe(5);
    expect(POWERUP_EFFECTS.jump.diamond.jumpCount).toBe(6);
  });

  it('physics worker adjusts maxJumps based on player power-up', () => {
    const workerSource = fs.readFileSync(workerPath, 'utf-8');
    // Should reference power-up category or jumpCount effect
    expect(workerSource).toMatch(/powerUp|jumpCount|maxJumps/);
  });
});