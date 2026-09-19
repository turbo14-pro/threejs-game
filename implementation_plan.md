# Implementation Plan: Tin Can Obstacle

## Overview
Add tin can obstacles to the FoodFrenzy 3D multiplayer game, positioned alongside cereal box obstacles. The tin cans will have distinct visual appearance and physics behavior.

## Requirements
1. **Visual Design**:
   - Cylindrical shape (8x30x8 dimensions)
   - Three colored side panels: Purple (#800080), Yellow (#ffff00), Blue (#0000ff)
   - Reflective metal grey top and bottom (#808080 with high metalness)
   - 16-sided cylinder for smooth appearance

2. **Physics Behavior**:
   - Kinematic rigid body type (like cereal boxes)
   - Cylinder collider shape
   - Restitution: 0.7, Friction: 3
   - Linear damping: 0.3, Angular damping: 0.5
   - Collision sensor to detect player hits
   - On hit: Apply velocity and angular velocity for tumbling

3. **Spawn Logic**:
   - 10 tin cans in the arena
   - Placed using seeded random (seed: 12345) for multiplayer sync
   - Minimum distance: 25 units from other obstacles
   - Not on starting platforms

## Files to Create/Modify

### New Files
1. `src/components/World/TinCanObstacle.jsx` - Tin can component with materials and physics

### Modified Files
1. `src/components/World/Arena.jsx` - Add import and render tin can obstacles

## Implementation Steps

### Step 1: Create TinCanObstacle Component
- [x] Create component with cylinder geometry
- [x] Implement three colored side materials (purple/yellow/blue)
- [x] Implement reflective top/bottom materials
- [x] Add physics component with cylinder collider
- [x] Add collision sensor with tumbling behavior

### Step 2: Update Arena.jsx
- [ ] Add import for TinCanObstacle
- [ ] Add tin can spawn logic (similar to cereal boxes)
- [ ] Render tin can obstacles in the scene

### Step 3: Testing
- [ ] Verify materials render correctly
- [ ] Verify physics collision works
- [ ] Verify tumbling behavior on player hit

## Open Questions
1. Should tin cans be affected by player velocity in the same way as cereal boxes?
2. Should tin cans have any special game mechanics (e.g., bonus points, different behavior)?

## Dependencies
- Three.js for geometry and materials
- React Three Fiber for component integration
- Rapier physics for collision detection
