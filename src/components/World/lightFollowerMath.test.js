import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  LIGHT_MAX_RADIUS,
  LIGHT_OFFSET,
  clampToRadius,
  computeLightTarget,
  createLightUpdater,
} from './lightFollowerMath.js';

describe('light offset constants', () => {
  it('offsets the sun by 50 m east, 50 m up and 50 m north', () => {
    expect(LIGHT_OFFSET.x).toBe(50);
    expect(LIGHT_OFFSET.y).toBe(50);
    expect(LIGHT_OFFSET.z).toBe(50);
    expect(LIGHT_MAX_RADIUS).toBe(50);
  });
});

describe('computeLightTarget', () => {
  it('places the light 50 m above and north-east of the player', () => {
    const out = new THREE.Vector3();

    computeLightTarget({ x: 10, y: 0, z: -10 }, out);

    expect(out.x).toBeCloseTo(60, 5);
    expect(out.y).toBeCloseTo(50, 5);
    expect(out.z).toBeCloseTo(40, 5);
  });

  it('tracks a different player position without reallocating', () => {
    const out = new THREE.Vector3();
    const first = computeLightTarget({ x: 0, y: 3, z: 0 }, out);
    const second = computeLightTarget({ x: -120, y: 12, z: 75 }, out);

    expect(second).toBe(out);
    expect(first).toBe(out);
    expect(out.x).toBeCloseTo(-70, 5);
    expect(out.y).toBeCloseTo(62, 5);
    expect(out.z).toBeCloseTo(125, 5);
  });

  it('treats a missing player position as the world origin', () => {
    const out = new THREE.Vector3();

    computeLightTarget(undefined, out);

    expect(out.x).toBeCloseTo(50, 5);
    expect(out.y).toBeCloseTo(50, 5);
    expect(out.z).toBeCloseTo(50, 5);
  });
});

describe('clampToRadius', () => {
  it('leaves a point inside the radius untouched', () => {
    const out = new THREE.Vector3();

    clampToRadius({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, 10, out);

    expect(out.x).toBeCloseTo(3, 5);
    expect(out.y).toBeCloseTo(4, 5);
    expect(out.z).toBeCloseTo(0, 5);
  });

  it('scales a point that escapes the radius back onto the sphere', () => {
    const out = new THREE.Vector3();

    clampToRadius({ x: 0, y: 0, z: 0 }, { x: 60, y: 50, z: 40 }, 50, out);

    expect(out.distanceTo(new THREE.Vector3(0, 0, 0))).toBeCloseTo(50, 5);
    expect(out.x).toBeCloseTo(60 * (50 / Math.hypot(60, 50, 40)), 5);
  });
});

describe('createLightUpdater', () => {
  it('writes the light position and keeps the target on the player', () => {
    const light = new THREE.DirectionalLight();
    light.target.position.set(0, 0, 0);
    const onTargetUpdate = vi.fn();
    const update = createLightUpdater(light, onTargetUpdate);

    update({ x: 10, y: 0, z: -10 });

    expect(light.position.x).toBeCloseTo(60, 5);
    expect(light.position.y).toBeCloseTo(50, 5);
    expect(light.position.z).toBeCloseTo(40, 5);
    expect(light.target.position.x).toBeCloseTo(10, 5);
    expect(light.target.position.y).toBeCloseTo(0, 5);
    expect(light.target.position.z).toBeCloseTo(-10, 5);
    expect(light.target.position.distanceTo(new THREE.Vector3(10, 0, -10))).toBeLessThanOrEqual(
      LIGHT_MAX_RADIUS
    );
    expect(onTargetUpdate).toHaveBeenCalledTimes(1);
  });

  it('reuses its scratch vectors across frames', () => {
    const light = new THREE.DirectionalLight();
    const update = createLightUpdater(light);
    const before = light.position;

    update({ x: 1, y: 1, z: 1 });
    update({ x: 2, y: 2, z: 2 });

    expect(light.position).toBe(before);
  });

  it('ignores non-finite positions so a physics glitch cannot move the sun', () => {
    const light = new THREE.DirectionalLight();
    const update = createLightUpdater(light);
    update({ x: 1, y: 2, z: 3 });
    const snapshot = light.position.clone();

    update({ x: Number.NaN, y: 0, z: 0 });

    expect(light.position.equals(snapshot)).toBe(true);
  });
});
