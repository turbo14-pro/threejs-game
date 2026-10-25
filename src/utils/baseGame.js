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
 * @param {Array} obstacles - Array of { x, y, z, w, h, d } obstacle boxes
 * @returns {boolean} true if grounded on floor, platform, or obstacle surface
 */
export function isGrounded(pos, obstacles = []) {
  // Ground at y=0 (table) or y=100 (platforms)
  // Capsule bottom at y - 1.5, so grounded when y <= 5.5
  if (pos.y <= 5.5 || (pos.y >= 99 && pos.y <= 105.5)) return true;

  // Check obstacle surfaces (cereal boxes)
  for (const obs of obstacles) {
    const halfW = (obs.w || 30) / 2;
    const halfH = (obs.h || 36) / 2;
    const halfD = (obs.d || 12) / 2;
    const topY = obs.y + halfH;
    // Player capsule bottom at y - 1.5; grounded when just above obstacle top
    if (
      pos.x >= obs.x - halfW - 1.5 &&
      pos.x <= obs.x + halfW + 1.5 &&
      pos.z >= obs.z - halfD - 1.5 &&
      pos.z <= obs.z + halfD + 1.5 &&
      pos.y <= topY + 1.5 &&
      pos.y >= topY - 0.5
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get the Y of the surface the player is standing on.
 * @param {Object} pos - { x, y, z } world position
 * @param {Array} obstacles - Array of { x, y, z, w, h, d } obstacle boxes
 * @returns {number} groundY (0 for floor, 100 for platforms, obstacle top Y, or -1 if airborne)
 */
export function getGroundY(pos, obstacles = []) {
  if (pos.y <= 5.5) return 0; // Floor
  if (pos.y >= 99 && pos.y <= 105.5) return 100; // Platform

  for (const obs of obstacles) {
    const halfW = (obs.w || 30) / 2;
    const halfH = (obs.h || 36) / 2;
    const halfD = (obs.d || 12) / 2;
    const topY = obs.y + halfH;
    if (
      pos.x >= obs.x - halfW - 1.5 &&
      pos.x <= obs.x + halfW + 1.5 &&
      pos.z >= obs.z - halfD - 1.5 &&
      pos.z <= obs.z + halfD + 1.5 &&
      pos.y <= topY + 1.5 &&
      pos.y >= topY - 0.5
    ) {
      return topY;
    }
  }

  return -1; // Airborne
}

/**
 * Get air jump velocity from PLAYER_BASELINE.
 * @returns {number} airJumpVelocity
 */
export function getAirJumpVelocity() {
  return PLAYER_BASELINE.movement.airJumpVelocity;
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
