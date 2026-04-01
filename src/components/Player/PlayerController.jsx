import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';

const direction = new THREE.Vector3();
const frontVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const camPos = new THREE.Vector3();

export default function PlayerController() {
  const rigidBodyRef = useRef();
  const playerGroupRef = useRef();
  const { camera, gl } = useThree();
  const { world, rapier } = useRapier();
  const gameState = useGameStore(state => state.gameState);
  const mobileInput = useGameStore(state => state.mobileInput);

  const [, getKeys] = useKeyboardControls();
  const [isMoving, setIsMoving] = useState(false);

  // Camera & Zoom State
  const rotationY = useRef(0);
  const rotationX = useRef(0);
  const zoomDistance = useRef(12); // Default zoom
  
  // Smoothed camera state to prevent clipping via lerp corners
  const smoothRotY = useRef(0);
  const smoothRotX = useRef(0);
  const smoothZoom = useRef(12);

  const lastTouch = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const onMouseMove = (e) => {
      if (document.pointerLockElement) {
        rotationY.current -= e.movementX * 0.002;
        rotationX.current -= e.movementY * 0.002;
        rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));
      }
    };

    const onWheel = (e) => {
      zoomDistance.current = Math.max(2, Math.min(25, zoomDistance.current + e.deltaY * 0.01));
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastPinchDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch.clientX > window.innerWidth / 2) {
          const dx = touch.clientX - lastTouch.current.x;
          const dy = touch.clientY - lastTouch.current.y;
          rotationY.current -= dx * 0.005;
          rotationX.current -= dy * 0.005;
          rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));
        }
        lastTouch.current = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (lastPinchDist.current - dist) * 0.05;
        zoomDistance.current = Math.max(2, Math.min(25, zoomDistance.current + delta));
        lastPinchDist.current = dist;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [gameState]);

  // Teleport handler (Moved to component Level)
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(
      state => state.teleportCount,
      (count) => {
        if (count > 0 && rigidBodyRef.current) {
          console.log("🚀 Spawning Player into Arena... Selection Event:", count);

          // Random location on the main arena floor (600x600 surface)
          const x = (Math.random() - 0.5) * 500;
          const z = (Math.random() - 0.5) * 500;

          // Force wake up and translate
          rigidBodyRef.current.wakeUp();
          rigidBodyRef.current.setTranslation({ x, y: 5, z }, true);
          rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

          // Lock pointer and set game state to playing
          try {
            gl.domElement.requestPointerLock();
          } catch (e) {
            console.warn("Pointer lock request failed (needs user gesture)");
          }
          useGameStore.setState({ gameState: 'PLAYING' });
        }
      }
    );
    return unsubscribe;
  }, [gl]);

  useFrame((state, delta) => {
    if (gameState !== 'PLAYING' || !rigidBodyRef.current || !playerGroupRef.current) return;

    const keys = getKeys();
    const translation = rigidBodyRef.current.translation();

    // SAFETY: If physics returns NaN, ignore this frame to avoid crashing the camera
    if (isNaN(translation.x) || isNaN(translation.y) || isNaN(translation.z)) return;

    const playerPos = translation;

    // Kill Plane
    if (playerPos.y < -250) {
      rigidBodyRef.current.setTranslation({ x: 0, y: 103, z: 0 }, true);
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    // Input Aggregation (Keyboard + Mobile)
    const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (mobileInput.x || 0);
    const moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0);
    const isSprinting = !!(keys.sprint || mobileInput.sprint);
    const isJumping = !!(keys.jump || mobileInput.jump);

    const speed = isSprinting ? 40 : 14;

    // Movement calculation
    frontVector.set(0, 0, moveZ);
    sideVector.set(-moveX, 0, 0);
    direction.subVectors(frontVector, sideVector);
    // CRITICAL: normalize() on a zero-vector produces NaN, which corrupts Rapier and freezes the game
    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(speed).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY.current);
    }

    const currentVelocity = rigidBodyRef.current.linvel();

    // Jump Logic
    if (isJumping && Math.abs(currentVelocity.y) < 0.1) {
      rigidBodyRef.current.setLinvel({ x: currentVelocity.x, y: 30, z: currentVelocity.z }, true);
    }

    // Apply Velocity
    rigidBodyRef.current.setLinvel({ x: direction.x, y: rigidBodyRef.current.linvel().y, z: direction.z }, true);

    // Sync animation state
    const moving = direction.lengthSq() > 0.01;
    if (moving !== isMoving) setIsMoving(moving);

    // Character rotation
    if (moving) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      playerGroupRef.current.rotation.y = THREE.MathUtils.lerp(playerGroupRef.current.rotation.y, targetRotation, 0.2);
    }

    // ----------------------------------------------------
    // OPTIMIZED 3RD PERSON CAMERA LOGIC (Rubber-banding & Raycast)
    // ----------------------------------------------------

    // 1. Smooth the raw inputs
    const rawRotY = isNaN(rotationY.current) ? 0 : rotationY.current;
    const rawRotX = isNaN(rotationX.current) ? 0 : rotationX.current;
    const rawZoom = isNaN(zoomDistance.current) ? 12 : zoomDistance.current;

    smoothRotY.current = THREE.MathUtils.lerp(smoothRotY.current, rawRotY, 0.3);
    smoothRotX.current = THREE.MathUtils.lerp(smoothRotX.current, rawRotX, 0.3);
    smoothZoom.current = THREE.MathUtils.lerp(smoothZoom.current, rawZoom, 0.2); // Expected zoom

    // 2. Determine camera direction vector
    const cameraOffset = new THREE.Vector3(0, 0, 1);
    cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), smoothRotX.current);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), smoothRotY.current);
    rayDirection.copy(cameraOffset).normalize();
    
    // 3. Define the Ray Origin (Target Point) with smoothing
    // We smooth the anchor point to give a "cinematic" follow feel to the camera's orbit center.
    if (!camera.userData.smoothedTarget) camera.userData.smoothedTarget = new THREE.Vector3().copy(playerPos);
    const targetYOffset = 2;
    const currentTarget = new THREE.Vector3(playerPos.x, playerPos.y + targetYOffset, playerPos.z);
    camera.userData.smoothedTarget.lerp(currentTarget, 0.2);
    const rayOrigin = camera.userData.smoothedTarget;

    // 4. RayCast — simple, stable, zero-allocation physics check.
    // By casting a ray and mathematically subtracting a "radius", we recreate volumetric 
    // physics padding identical to the snippet provided (space - radius).
    const ray = new rapier.Ray(rayOrigin, rayDirection);
    
    // castRay(ray, maxToi, solid, collisionGroups, filterFlags, filterCollider, filterRigidBody)
    const hit = world.castRay(
      ray, 
      smoothZoom.current, 
      false, 
      0x00010001, 
      undefined, 
      undefined, 
      rigidBodyRef.current // Ignore player capsule!
    );

    let hitDistance = undefined;
    if (hit) {
      if (typeof hit.toi === 'number') hitDistance = hit.toi;
      else if (typeof hit.time_of_impact === 'number') hitDistance = hit.time_of_impact;
      else if (typeof hit === 'number') hitDistance = hit;
    }

    let maxSafeDist = smoothZoom.current;
    if (hitDistance !== undefined && isFinite(hitDistance)) {
      const cameraCollisionRadius = 0.6; // Padding to clear the near-plane
      maxSafeDist = hitDistance - cameraCollisionRadius;
    }

    // 5. Rubber-band interpolation of the ACTUAL zoom distance
    if (camera.userData.currentZoom === undefined || isNaN(camera.userData.currentZoom)) {
      camera.userData.currentZoom = 12;
    }
    
    // Hard clamp to ensure the camera doesn't flip through the target
    maxSafeDist = Math.max(0.1, maxSafeDist);

    if (camera.userData.currentZoom > maxSafeDist) {
      // Snap/fast-lerp inwards to immediately resolve collisions
      camera.userData.currentZoom = THREE.MathUtils.lerp(camera.userData.currentZoom, maxSafeDist, 0.4);
    } else {
      // Slow-lerp outwards when the path clears
      camera.userData.currentZoom = THREE.MathUtils.lerp(camera.userData.currentZoom, maxSafeDist, 0.05);
    }

    // Prevent NaN corruption
    if (isNaN(camera.userData.currentZoom) || !isFinite(camera.userData.currentZoom)) {
      camera.userData.currentZoom = 12;
    }

    // 6. Calculate absolute camera coordinates
    camPos.copy(rayOrigin).addScaledVector(rayDirection, camera.userData.currentZoom);

    // Final Validation & Fluid Application
    if (!isNaN(camPos.x) && !isNaN(camPos.y) && !isNaN(camPos.z)) {
      // Direct assignment instead of lerp! 
      // Lerping position cuts corners into geometry, causing the camera to clip through walls and floors.
      camera.position.copy(camPos);
    }

    // Look at the smoothed target
    camera.lookAt(rayOrigin);
  });

  return (
    <RigidBody ref={rigidBodyRef} position={[0, 103, 0]} colliders={false} enabledRotations={[false, false, false]} mass={1} collisionGroups={0x0001FFFF}>
      <CapsuleCollider args={[0.5, 0.5]} />
      <group ref={playerGroupRef} position={[0, -1, 0]}>
        <PlayerModel isMoving={isMoving} isSprinting={useKeyboardControls(s => s.sprint) || mobileInput.sprint} />
      </group>
    </RigidBody>
  );
}

