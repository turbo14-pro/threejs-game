/**
 * BaseGame — shared physics logic between client and server.
 * Single source of truth for movement, ground checks, and physics constants.
 * Imported by both PlayerController.jsx (client) and server/index.js (server).
 */
import { PLAYER_BASELINE } from '../config/playerConfig.js';

export { PLAYER_BASELINE };

/**
 * Compute movement velocity from input + camera rotation.
 * Pure function — no DOM, no Rapier, no Three.js dependencies.
 * @param {Object} input - { w, a, s, d, jump, walk, slide, dash }
 * @param {number} camRot - camera yaw in radians
 * @param {number} speed - movement speed (walk or sprint)
 * @returns {Object} { vx, vz } world-space velocity components
 */
export function computeVelocity(input, camRot, speed) {
  const { w, a, s, d } = input;
  const moveX = (d ? 1 : 0) - (a ? 1 : 0);
  const moveZ = (s ? 1 : 0) - (w ? 1 : 0);

  if (moveX === 0 && moveZ === 0) {
    return { vx: 0, vz: 0 };
  }

  const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
  const nx = moveX / length;
  const nz = moveZ / length;

  // Rotate by camera angle (match client applyAxisAngle)
  const rot = camRot;
  const vx = (nx * Math.cos(rot) + nz * Math.sin(rot)) * speed;
  const vz = (-nx * Math.sin(rot) + nz * Math.cos(rot)) * speed;

  return { vx, vz };
}

/**
 * Ground check matching client capsule logic.
 * @param {Object} pos - { x, y, z } world position
 * @returns {boolean} true if grounded
 */
export function isGrounded(pos) {
  // Ground at y=0 (table) or y=100 (platforms)
  // Capsule bottom at y - 1.5, so grounded when y <= 5.5
  return pos.y <= 5.5 || (pos.y >= 99 && pos.y <= 105.5);
}

/**
 * Get movement speed based on walk/sprint input.
 * @param {boolean} walk - walking input
 * @returns {number} walkSpeed or sprintSpeed
 */
export function getSpeed(walk) {
  return walk ? PLAYER_BASELINE.movement.walkSpeed : PLAYER_BASELINE.movement.sprintSpeed;
}

/**
 * Get jump velocity from PLAYER_BASELINE.
 * @returns {number} jumpVelocity
 */
export function getJumpVelocity() {
  return PLAYER_BASELINE.movement.jumpVelocity;
}

/**
 * Get dash speed from PLAYER_BASELINE.
 * @returns {number} dashSpeed
 */
export function getDashSpeed() {
  return PLAYER_BASELINE.dash.dashSpeed;
}

/**
 * Get slide speed from PLAYER_BASELINE.
 * @returns {number} slideSpeed
 */
export function getSlideSpeed() {
  return PLAYER_BASELINE.movement.slideSpeed;
}
