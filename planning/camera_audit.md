# Camera Audit – Over‑the‑Shoulder Camera with Collision Handling

## Overview
This document captures the best‑practice pattern for implementing an over‑the‑shoulder camera in a three.js‑based multiplayer game that:

1. **Follows the player** from behind while allowing smooth left/right panning.
2. **Detects collisions** with world geometry (using ray‑ or shape‑casting) when the camera is repositioned.
3. **Adjusts the camera position** to keep the player visible without clipping through walls or obstacles.
4. **Keeps the camera in sync** with teleportation or other rapid player movements.

## Recommended Implementation

### 1. Camera Follow Logic
```javascript
// Inside PlayerController.jsx (or a dedicated camera module)
function updateCamera(delta) {
  const targetPos = player.position.clone(); // player is the three.js Object3D
  const desiredCamPos = targetPos.clone().add(cameraOffset);

  // Perform collision check before setting the final camera position
  const collisionPos = checkCameraCollision(desiredCamPos);
  camera.position.copy(collisionPos);
}
```

### 2. Collision Detection Strategy
- **Shape Casting**: Use `castShape` (Rapier) or `raycast` (three.js) from the intended camera position toward the player.
- **Obstacle Detection**: If the cast hits a collidable object within a short distance (e.g., 0.5 units), move the camera forward until the hit point is just in front of the obstacle.
- **Fallback**: If no collision is detected, keep the original `desiredCamPos`.

```javascript
async function checkCameraCollision(targetPos) {
  // Rapier shape cast example
  const result = await castShape({
    shape: 'ball',
    radius: 0.3,
    origin: targetPos,
    direction: cameraOffset.clone().normalize().multiplyScalar(-1),
    maxDistance: cameraOffset.length(),
  });

  if (result && result.hit) {
    // Place camera just in front of the hit point
    return result.hitPoint.clone().add(
      result.hitNormal.clone().multiplyScalar(0.01)
    );
  }
  return targetPos; // No collision – keep original position
}
```

### 3. Handling Left/Right Panning
When the player pans left or right (e.g., via mouse movement), recalculate `cameraOffset` accordingly, then run the collision check **each frame** to ensure the camera never clips through geometry.

```javascript
function onMousePan(deltaX) {
  // Adjust horizontal offset based on deltaX
  cameraOffset.x += deltaX * 0.01;
  // Re‑apply collision check
  updateCamera();
}
```

### 4. Teleport / Rapid Movement Sync
If the player teleports, reset the camera to a safe distance behind the player and re‑run the collision check to avoid sudden clipping.

```javascript
function onPlayerTeleport() {
  cameraOffset.copy(defaultOffset);
  updateCamera();
}
```

### 5. Configuration Parameters
| Parameter | Suggested Value | Description |
|-----------|----------------|-------------|
| `cameraOffset` | `{ x: 0, y: 1.5, z: -3 }` | Initial offset behind and above the player. |
| `collisionRadius` | `0.3` | Radius of the shape used for casting. |
| `maxCollisionDistance` | `cameraOffset.length()` | Maximum distance to cast for collisions. |
| `collisionOffset` | `0.01` | Small offset to keep the camera just in front of obstacles. |

### 6. Performance Tips
- **Throttle Collision Checks**: Run the collision test at most every other frame (`if (frameId % 2 === 0) …`) when the camera is static.
- **Cache Results**: Store the last collision result and reuse it if the player hasn’t moved significantly.
- **Use Efficient Colliders**: Prefer simple shapes (sphere, capsule) for fast broad‑phase checks.

## Integration Checklist
- [ ] Add `checkCameraCollision` helper to `PlayerController.jsx` (or a dedicated `cameraUtils.js`).
- [ ] Replace the existing camera update loop with the new `updateCamera` logic.
- [ ] Ensure `castShape`/`raycast` is performed with the correct collider groups.
- [ ] Test panning left/right, teleport scenarios, and edge‑case collisions.
- [ ] Document any tuning of `cameraOffset` and collision radii in this audit file.

## References
- **PlayerController.jsx** – Current camera logic (modified in the latest edit).
- **Rapier Documentation** – Shape casting API.
- **three.js Raycaster** – `Raycaster` class for alternative collision detection.

*Prepared by the camera audit sub‑team – see `implementation_plan.md` for broader project milestones.*