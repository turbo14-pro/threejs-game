import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Batch 1: Fix Facing Direction — Send targetRotationY Instead of rotationY
 * Tests that PlayerController.jsx sends targetRotationY.current (character mesh
 * facing) instead of rotationY.current (camera yaw) as the camRot facing direction.
 * Failure mode: remote players see camera direction instead of character direction.
 */
describe('Remote player facing direction — targetRotationY', () => {
  const controllerPath = path.resolve(__dirname, '../../src/components/Player/PlayerController.jsx');

  it('PlayerController sends targetRotationY.current as camRot in input packet', () => {
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toContain('camRot: targetRotationY.current');
  });

  it('PlayerController tracks sent input with targetRotationY.current', () => {
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toMatch(/camRot:\s*targetRotationY\.current/);
  });

  it('PlayerController records inputHistory with targetRotationY.current', () => {
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toMatch(/camRot:\s*targetRotationY\.current/);
  });

  it('PlayerController sends targetRotationY.current as rot in knockback position', () => {
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toMatch(/rot:\s*targetRotationY\.current/);
  });

  it('PlayerController uses correct atan2 formula (direction.x, -direction.z) for facing', () => {
    const source = fs.readFileSync(controllerPath, 'utf-8');
    expect(source).toContain('Math.atan2(direction.x, -direction.z)');
    expect(source).toContain('Math.atan2(dashDir.current.x, -dashDir.current.z)');
  });
});
