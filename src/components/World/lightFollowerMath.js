import * as THREE from "three";

/**
 * Offset applied to the player position to place the sun: +X (east),
 * +Y (up) and +Z (north). Exactly 50 m on every axis keeps the light
 * diagonally north-east and above the player at all times.
 *
 * @type {Readonly<{x: number, y: number, z: number}>}
 */
export const LIGHT_OFFSET = Object.freeze({ x: 50, y: 50, z: 50 });

/**
 * Maximum distance the light's aim point may drift from the player.
 * The unit here is metres.
 *
 * @type {number}
 */
export const LIGHT_MAX_RADIUS = 50;

const _anchor = new THREE.Vector3();
const _delta = new THREE.Vector3();

/**
 * Compute the world-space position for the sun from the player position.
 * The result is `player + (50, 50, 50)`, i.e. 50 m east, 50 m above and
 * 50 m north. The supplied `out` vector is written in place so callers can
 * reuse a single `THREE.Vector3` for the whole game loop.
 *
 * @param {{x: number, y: number, z: number} | null | undefined} playerPosition
 *        Current player world coordinates. Missing values fall back to the origin.
 * @param {THREE.Vector3} out Destination vector (reused, never reallocated).
 * @returns {THREE.Vector3} The same `out` instance, for chaining.
 */
export function computeLightTarget(playerPosition, out) {
  const source = playerPosition || { x: 0, y: 0, z: 0 };
  const x = Number.isFinite(source.x) ? source.x : 0;
  const y = Number.isFinite(source.y) ? source.y : 0;
  const z = Number.isFinite(source.z) ? source.z : 0;

  return out.set(x + LIGHT_OFFSET.x, y + LIGHT_OFFSET.y, z + LIGHT_OFFSET.z);
}

/**
 * Clamp `target` so it never sits farther than `maxRadius` from `anchor`.
 * Points inside the sphere are copied unchanged; points outside are scaled
 * back along the anchor→target direction, which keeps the sun inside the
 * bounded region without snapping or jitter.
 *
 * @param {{x: number, y: number, z: number}} anchor Sphere centre (the player).
 * @param {{x: number, y: number, z: number}} target Point to constrain.
 * @param {number} maxRadius Maximum allowed distance, in metres.
 * @param {THREE.Vector3} out Destination vector (reused, never reallocated).
 * @returns {THREE.Vector3} The same `out` instance.
 */
export function clampToRadius(anchor, target, maxRadius, out) {
  _anchor.set(anchor.x, anchor.y, anchor.z);
  _delta.set(target.x - _anchor.x, target.y - _anchor.y, target.z - _anchor.z);

  const distance = _delta.length();
  if (distance > maxRadius && distance > 0) {
    _delta.multiplyScalar(maxRadius / distance);
  }

  return out.copy(_anchor).add(_delta);
}

/**
 * Build a per-frame updater for a directional light. The returned function
 * writes the sun position (player + 50 m north-east and up) and pins the
 * light target to the player so the parallel rays always aim at the
 * character. The target is clamped to {@link LIGHT_MAX_RADIUS} around the
 * player, so the shadow camera can never be dragged far away.
 *
 * @param {THREE.DirectionalLight} light Directional light to drive.
 * @param {(() => void) | null} [onTargetUpdate] Optional callback invoked after
 *        the target moves, e.g. to call `light.shadow.camera.updateProjectionMatrix()`.
 * @returns {(playerPosition: {x: number, y: number, z: number} | null | undefined) => void}
 *          Frame callback that accepts the current player position.
 */
export function createLightUpdater(light, onTargetUpdate = null) {
  const targetPosition = new THREE.Vector3();
  const aimPosition = new THREE.Vector3();

  return function updateLight(playerPosition) {
    if (!playerPosition) return;
    if (
      !Number.isFinite(playerPosition.x) ||
      !Number.isFinite(playerPosition.y) ||
      !Number.isFinite(playerPosition.z)
    ) {
      return;
    }

    computeLightTarget(playerPosition, targetPosition);
    light.position.copy(targetPosition);

    // Target the player directly so the shadow frustum centers on them.
    // (Clamping anchor=target=playerPosition is a no-op, kept for API symmetry.)
    clampToRadius(playerPosition, playerPosition, LIGHT_MAX_RADIUS, aimPosition);
    light.target.position.copy(aimPosition);
    // Ensure the shadow camera sees the new target position this frame.
    light.target.updateMatrixWorld(true);
    if (light.shadow?.camera) {
      light.shadow.camera.updateProjectionMatrix();
    }
    if (onTargetUpdate) onTargetUpdate();
  };
}

/**
 * The following module is used by `LightFollower` inside the R3F tree.
 *
 * Algorithm: each animation frame the player's world position is read from the
 * game store and the sun is placed 50 m east, 50 m north and 50 m above that
 * point, so its parallel rays always fall on the player at a consistent angle.
 * The light's target is kept pinned to the player and clamped to a 50 m radius,
 * which keeps the shadow frustum centred on the action without allocating
 * anything per frame.
 */
