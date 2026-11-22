/**
 * BaseGame Module - Shared Physics and Movement Logic
 *
 * This module contains the core physics and movement logic that will be shared between:
 * - Local player character
 * - Remote player character
 * - Bot characters
 *
 * Key Features:
 * - Capsule collider configuration
 * - Ground detection and correction logic
 * - Movement velocity calculation
 * - Input sanitization helpers
 * - Common constants and configuration
 */

export const PLAYER_CAPSULE_HALF_HEIGHT = 1.5;
export const PLAYER_CAPSULE_RADIUS = 1;
export const GROUND_CORRECTION_FLOOR = 0.75;
export const GROUND_CORRECTION_PLATFORM = 1.5;

// Movement velocity calculation from input
export function calculateMovementVelocity(input, cameraRotation) {
    const {w, a, s, d, jump, walk, slide, dash} = input;

    // Calculate movement direction based on camera rotation
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    cameraRotation.multiplyVectors(new THREE.Vector3(0, 0, 1), cameraRotation.clone().normalize());
    cameraRotation.multiplyVectors(new THREE.Vector3(1, 0, 0), cameraRotation.clone().normalize());

    forward.copy(cameraRotation).normalize();
    right.copy(cameraRotation.clone().multiply(new THREE.Vector3(0, 0, 1))).normalize();

    const velocity = new THREE.Vector3();
    velocity.x = (w - s) * PLAYER_SPEED + (d - a) * PLAYER_SPEED;
    velocity.z = (a - w) * PLAYER_SPEED + (d - a) * PLAYER_SPEED;

    // Apply sliding and dash modifiers
    if (slide) {
        velocity.z -= PLAYER_SLIDE_SPEED;
    }
    if (dash) {
        velocity.z -= PLAYER_DASH_SPEED;
    }

    return velocity;
}

// Ground detection and correction
export function getGroundY(position, groundY) {
    // Apply ground correction based on surface type
    if (groundY === "floor") {
        return groundY + PLAYER_CAPSULE_HALF_HEIGHT + GROUND_CORRECTION_FLOOR;
    } else if (groundY === "platform") {
        return groundY + PLAYER_CAPSULE_HALF_HEIGHT + GROUND_CORRECTION_PLATFORM;
    }
    return position.y;
}

// Input sanitization helpers
export function sanitizeInput(input) {
    // Ensure all required properties exist
    const sanitized = {...input};
    sanitized.w = sanitized.w !== undefined ? sanitized.w : 0;
    sanitized.a = sanitized.a !== undefined ? sanitized.a : 0;
    sanitized.s = sanitized.s !== undefined ? sanitized.s : 0;
    sanitized.d = sanitized.d !== undefined ? sanitized.d : 0;
    sanitized.jump = sanitized.jump !== undefined ? sanitized.jump : 0;
    sanitized.walk = sanitized.walk !== undefined ? sanitized.walk : 0;
    sanitized.slide = sanitized.slide !== undefined ? sanitized.slide : 0;
    sanitized.dash = sanitized.dash !== undefined ? sanitized.dash : 0;
    return sanitized;
}

// Common constants
export const PLAYER_SPEED = 8;
export const PLAYER_SLIDE_SPEED = 15;
export const PLAYER_DASH_SPEED = 30;
export const PLAYER_JUMP_FORCE = 12;
