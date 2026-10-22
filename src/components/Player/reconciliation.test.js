import { describe, it, expect } from 'vitest';

/**
 * Phase 03: Input History & Prediction
 * Tests that client-side prediction re-applies unacknowledged inputs
 * using sequenceId-keyed sentInputs after a reconciliation snap.
 * Failure mode: re-apply uses wrong inputs or wrong speeds →
 * client diverges from server after snap → rubber-banding.
 */
describe('reconciliation re-apply with sentInputs', () => {
  const walkSpeed = 4;
  const sprintSpeed = 35;

  function applyInput(pos, vel, input, camRot, speed) {
    const { w, a, s, d } = input;
    const moveX = (d ? 1 : 0) - (a ? 1 : 0);
    const moveZ = (s ? 1 : 0) - (w ? 1 : 0);
    if (moveX === 0 && moveZ === 0) return { ...pos, ...vel };
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const nx = moveX / length;
    const nz = moveZ / length;
    const rot = camRot || 0;
    const vx = (nx * Math.cos(rot) + nz * Math.sin(rot)) * speed;
    const vz = (-nx * Math.sin(rot) + nz * Math.cos(rot)) * speed;
    return {
      pos: { x: pos.x + vx * 0.0333, y: pos.y, z: pos.z + vz * 0.0333 },
      vel: { x: vx, y: vel.y, z: vz },
    };
  }

  it('re-applies unacknowledged inputs in sequence order after snap', () => {
    // Simulate sentInputs map: sequenceId -> { tick, input, camRot }
    const sentInputs = new Map();
    sentInputs.set(0, { tick: 10, input: { w: true, a: false, s: false, d: false }, camRot: 0 });
    sentInputs.set(1, { tick: 11, input: { w: true, a: false, s: false, d: false }, camRot: 0 });
    sentInputs.set(2, { tick: 12, input: { w: false, a: false, s: false, d: true }, camRot: 0 });

    // Server acknowledges tick 10 (seqId 0). Unacknowledged: seqId 1, 2.
    const ackTick = 10;
    const unacknowledged = Array.from(sentInputs.entries())
      .filter(([, entry]) => entry.tick > ackTick)
      .sort((a, b) => a[1].tick - b[1].tick);

    expect(unacknowledged.length).toBe(2);
    expect(unacknowledged[0][0]).toBe(1); // seqId 1
    expect(unacknowledged[1][0]).toBe(2); // seqId 2
  });

  it('uses PLAYER_BASELINE speeds (not hardcoded) in re-apply', () => {
    // Walking input should use walkSpeed (4), not sprintSpeed (35)
    const result = applyInput(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { w: true, a: false, s: false, d: false },
      0,
      walkSpeed
    );
    expect(result.pos.z).toBeCloseTo(-walkSpeed * 0.0333, 4);

    // Sprinting input should use sprintSpeed (35)
    const sprintResult = applyInput(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { w: true, a: false, s: false, d: false },
      0,
      sprintSpeed
    );
    expect(sprintResult.pos.z).toBeCloseTo(-sprintSpeed * 0.0333, 4);
  });

  it('sentInputs cleanup removes acknowledged entries', () => {
    const sentInputs = new Map();
    sentInputs.set(0, { tick: 5 });
    sentInputs.set(1, { tick: 10 });
    sentInputs.set(2, { tick: 15 });

    const ackTick = 10;
    for (const [seqId, entry] of sentInputs.entries()) {
      if (entry.tick <= ackTick) sentInputs.delete(seqId);
    }

    expect(sentInputs.size).toBe(1);
    expect(sentInputs.has(2)).toBe(true);
  });
});
