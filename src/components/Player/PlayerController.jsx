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
  const [, getKeys] = useKeyboardControls();
  const gameState = useGameStore(state => state.game.state);
  const mobileInput = useGameStore(state => state.mobileInput);
  const teleportCount = useGameStore(state => state.teleportCount);
  const matchPhase = useGameStore(state => state.game.phase);
  const countdown = useGameStore(state => state.game.countdown);
  const playerHealth = useGameStore(state => state.player.health);
  const healPlayer = useGameStore(state => state.healPlayer);

  // --- PLAYER STATE ---
  const [isSliding, setIsSliding] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [moveDir, setMoveDir] = useState('for');
  const [jumpPhase, setJumpPhase] = useState('none'); // none, launch, air, land
  const [animConfig, setAnimConfig] = useState(null);

  // --- REFS / TIMERS ---
  const slideTimer = useRef(0);
  const lastDamageTime = useRef(0);
  const jumpTimer = useRef(0);
  const physicsJumpTriggered = useRef(false);
  const jumpLock = useRef({ sprint: false, dir: 'for' });

  // Load animation configuration dynamically
  useEffect(() => {
    fetch('/skins/animations.json')
      .then(res => res.json())
      .then(data => setAnimConfig(data.Melee))
      .catch(err => console.error("Failed to load animations.json", err));
  }, []); // Lock animation states during jump phase

  // Camera & Zoom State
  const rotationY = useRef(Math.PI);
  const rotationX = useRef(0);
  const zoomDistance = useRef(12); // Default zoom

  // Smoothed camera state to prevent clipping via lerp corners
  const smoothRotY = useRef(Math.PI);
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

          // Force wake up and translate
          rigidBodyRef.current.wakeUp();

          // We check the phase to see where to teleport
          const currentPhase = useGameStore.getState().game.phase;
          
          if (currentPhase === 'LOBBY') {
            // Back to platform
            rigidBodyRef.current.setTranslation({ x: 0, y: 103, z: 0 }, true);
          } else {
            // Into random arena spot
            const x = (Math.random() - 0.5) * 500;
            const z = (Math.random() - 0.5) * 500;
            rigidBodyRef.current.setTranslation({ x, y: 5, z }, true);
          }

          rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

          // Lock pointer and set game state to playing
          try {
            gl.domElement.requestPointerLock();
          } catch (e) {
            console.warn("Pointer lock request failed (needs user gesture)");
          }
          useGameStore.getState().setGameState('PLAYING');
        }
      }
    );
    return unsubscribe;
  }, [gl]);

  // Respawn handler (teleport back to platform 1)
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(
      state => state.respawnCount,
      (count) => {
        if (count > 0 && rigidBodyRef.current) {
          console.log("🔄 Respawning Player to Platform 1", count);

          rigidBodyRef.current.wakeUp();
          rigidBodyRef.current.setTranslation({ x: 0, y: 103, z: 0 }, true);
          rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rotationY.current = Math.PI;
          smoothRotY.current = Math.PI;
          if (playerGroupRef.current) {
            playerGroupRef.current.rotation.y = Math.PI;
          }

          try {
            gl.domElement.requestPointerLock();
          } catch (e) {
            console.warn("Pointer lock request failed");
          }
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
      rotationY.current = Math.PI;
      smoothRotY.current = Math.PI;
      if (playerGroupRef.current) {
        playerGroupRef.current.rotation.y = Math.PI;
      }
      return;
    }

    // Input Aggregation (Keyboard + Mobile)
    const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (mobileInput.x || 0);
    const moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0);
    const walkingInput = !!(keys.walk || mobileInput.walk);
    const jumpingInput = !!(keys.jump || mobileInput.jump);
    const slidingInput = !!(keys.slide || mobileInput.slide);

    // Reliable ground detection via Raycast (MOVED TO TOP)
    const rayOriginG = { x: playerPos.x, y: playerPos.y - 1.2, z: playerPos.z };
    const rayDirG = { x: 0, y: -1, z: 0 };
    const groundHit = world.castRay(new rapier.Ray(rayOriginG, rayDirG), 0.8, true, null, 0x0001FFFF, null, rigidBodyRef.current);
    const currentlyGrounded = groundHit !== null;

    // 1. PHASE HANDLING: Freeze player during PREMATCH and DROP
    if (matchPhase === 'PREMATCH' || (matchPhase === 'DROP' && countdown > 0)) {
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    // Determine movement direction vector
    frontVector.set(0, 0, moveZ);
    sideVector.set(-moveX, 0, 0);
    direction.subVectors(frontVector, sideVector);
    const moving = direction.lengthSq() > 0.01;

    // 2. SLIDE LOGIC
    if (slidingInput && !isSliding && currentlyGrounded && moving && !walkingInput) {
      setIsSliding(true);
      slideTimer.current = 0.6; // 0.6s slide
      // Add a burst of speed
      direction.multiplyScalar(1.5);
    }

    if (isSliding) {
      slideTimer.current -= delta;
      if (slideTimer.current <= 0 || !currentlyGrounded) {
        setIsSliding(false);
      }
    }

    // 3. PASSIVE REGENERATION (Heals if not damaged for 5s)
    if (Date.now() - lastDamageTime.current > 5000 && playerHealth < 100) {
      healPlayer(10 * delta); // Heal 10 HP per second
    }

    const speed = isSliding ? 45 : (walkingInput ? 8 : 30);

    // apply speed and rotation to direction
    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(speed).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY.current);
    }

    const currentVelocity = rigidBodyRef.current.linvel();

    // Ground detection already calculated above

    // Jump State Machine
    let currentPhase = jumpPhase;

    if (currentlyGrounded) {
       // Only allow landing if moving down or stationary
       if (currentPhase === 'air' && currentVelocity.y <= 1.0) {
           currentPhase = 'land';
           jumpTimer.current = 10 / 30; // Wait 10 frames of land before allowing move/idle
       }
       
       if (currentPhase === 'land' || currentPhase === 'none') {
            if (jumpingInput && Math.abs(currentVelocity.y) < 2.0 && animConfig) {
                const config = !walkingInput ? animConfig.run_jump : animConfig.jump;
               currentPhase = 'launch';
               jumpTimer.current = config.launchFrames / 30; // Use JSON values
               physicsJumpTriggered.current = false;
           } else if (currentPhase === 'land') {
               jumpTimer.current -= delta;
               if (jumpTimer.current <= 0 || (direction.lengthSq() > 0.01 && currentlyGrounded)) {
                   currentPhase = 'none';
               }
           }
       }

       if (currentPhase === 'launch') {
           jumpTimer.current -= delta;
           const config = jumpLock.current.sprint ? animConfig.run_jump : animConfig.jump;
           
           // DYNAMIC LIFTOFF: Trigger physics jump at frame 6 (0.2s) regardless of total launch frames
           // This provides snappy feedback while the launch animation continues visually.
           const triggerTime = Math.max(0.05, (config.launchFrames - 6) / 30);
           if (!physicsJumpTriggered.current && jumpTimer.current <= triggerTime) {
               rigidBodyRef.current.setLinvel({ x: currentVelocity.x, y: 30, z: currentVelocity.z }, true);
               physicsJumpTriggered.current = true;
           }

           if (jumpTimer.current <= 0) {
               currentPhase = 'air'; 
           }
       }
    } else {
       // We are freely in the air
       if (currentPhase === 'none' || currentPhase === 'land') {
           currentPhase = 'air';
       }
       if (currentPhase === 'launch') {
           jumpTimer.current -= delta;
           const config = jumpLock.current.sprint ? animConfig.run_jump : animConfig.jump;
           
           // Dynamic liftoff even if we fell off a ledge mid-launch
           const triggerTime = Math.max(0.05, (config.launchFrames - 6) / 30);
           if (!physicsJumpTriggered.current && jumpTimer.current <= triggerTime) {
               rigidBodyRef.current.setLinvel({ x: currentVelocity.x, y: 30, z: currentVelocity.z }, true);
               physicsJumpTriggered.current = true;
           }
           
           if (jumpTimer.current <= 0) {
               currentPhase = 'air'; 
           }
       }
    }

    if (jumpPhase !== currentPhase) {
        // When starting a jump, lock the current walk/dir state for the animation
        if (jumpPhase === 'none' && (currentPhase === 'launch' || currentPhase === 'air')) {
          jumpLock.current = { sprint: !walkingInput, dir: moveDir };
        }
        setJumpPhase(currentPhase);
    }

    // Apply Horizontal Velocity ONLY (preserve vertical velocity)
    rigidBodyRef.current.setLinvel({ x: direction.x, y: rigidBodyRef.current.linvel().y, z: direction.z }, true);

    // Sync movement direction for animations with hysteresis
    if (moving !== isMoving) setIsMoving(moving);

    if (walkingInput !== isWalking) setIsWalking(walkingInput);

    // Contextual movement: Backwards logic
    // Determine if we should walk backwards based on mesh forward vs camera forward
    const meshForward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroupRef.current.quaternion);
    const camForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY.current);
    
    // dot > 0.3 defines a VERY generous ~144-degree detection zone
    // We use a significant hysteresis (0.0 vs 0.3) so that once you start backing up, 
    // it's very "sticky" and won't flip until you face almost sideways to the camera.
    const dotThreshold = moveDir === 'bac' ? -0.2 : 0.3;
    const facingAwayFromCamera = meshForward.dot(camForward) > dotThreshold;
    const isInputBack = moveZ > 0.05;
    const shouldBackUp = isInputBack && facingAwayFromCamera;

    let currentMoveDir = 'for';
    if (moving) {
      if (shouldBackUp) {
        currentMoveDir = 'bac';
        const targetRotation = rotationY.current + Math.PI;
        playerGroupRef.current.rotation.y = THREE.MathUtils.lerp(playerGroupRef.current.rotation.y, targetRotation, 0.2);
      } else {
        currentMoveDir = 'for';
        const targetRotation = Math.atan2(direction.x, direction.z);
        playerGroupRef.current.rotation.y = THREE.MathUtils.lerp(playerGroupRef.current.rotation.y, targetRotation, 0.2);
      }
    }
    
    if (currentMoveDir !== moveDir) setMoveDir(currentMoveDir);

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

    // 4. RayCast with proper Rapier API parameter ordering.
    // CRITICAL FIX: 0x00010001 was previously passed as filterFlags (param 4),
    // which set EXCLUDE_FIXED — silently ignoring ALL arena geometry (floor, walls, platforms).
    // It must be filterGroups (param 5) to act as collision group filtering.
    // 4. ShapeCast — sweep a Ball(0.5) from player head outward to find safe camera distance
    // This gives the camera physical volume, preventing clipping through corners and floors.
    let maxSafeDist = smoothZoom.current;

    try {
      // Lazily create and cache the Ball shape and orientation
      if (!camera.userData._cameraShape) {
        camera.userData._cameraShape = new rapier.Ball(0.5);
      }

      const shapeOrigin = { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z };
      const shapeRotation = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
      const shapeVelocity = { x: rayDirection.x, y: rayDirection.y, z: rayDirection.z };

      // castShape signature: (pos, rot, vel, shape, targetDist, maxToi, stopAtPenetration, flags, groups, excCollider, excRigidBody)
      const hit = world.castShape(
        shapeOrigin,
        shapeRotation,
        shapeVelocity,
        camera.userData._cameraShape,
        0.0,                 // targetDistance (0 = traditional sweep)
        smoothZoom.current,  // maxToi (Distance)
        true,                // stopAtPenetration
        null,                // filterFlags
        0x00010001,          // filterGroups
        null,                // filterExcludeCollider
        rigidBodyRef.current // filterExcludeRigidBody (Ignore player)
      );

      if (hit) {
        const toi = hit.toi ?? hit.time_of_impact;
        if (typeof toi === 'number' && isFinite(toi)) {
          maxSafeDist = toi;
        }
      }
    } catch (e) {
      // Fallback
      console.warn('[Camera] castShape error:', e.message);
      const ray = new rapier.Ray(rayOrigin, rayDirection);
      const backupHit = world.castRay(ray, smoothZoom.current, false, null, 0x00010001, null, rigidBodyRef.current);
      if (backupHit) maxSafeDist = Math.max(0.5, backupHit.toi - 0.5);
    }
    // Hard clamp to ensure the camera doesn't flip through the target
    maxSafeDist = Math.max(0.1, maxSafeDist);

    // 5. Rubber-band interpolation of the ACTUAL zoom distance
    if (camera.userData.currentZoom === undefined || isNaN(camera.userData.currentZoom)) {
      camera.userData.currentZoom = 12;
    }

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
      
      // Hide player model if camera is squished against the wall
      if (playerGroupRef.current) {
        playerGroupRef.current.visible = camera.userData.currentZoom > 1.2;
      }
    }

    // Look at the smoothed target
    camera.lookAt(rayOrigin);
  });

  return (
    <RigidBody ref={rigidBodyRef} position={[0, 103, 0]} colliders={false} enabledRotations={[false, false, false]} mass={1} collisionGroups={0x0001FFFF} friction={0}>
      <CapsuleCollider args={isSliding ? [0.2, 0.8] : [0.5, 0.8]} />
      <group ref={playerGroupRef} position={[0, isSliding ? -0.8 : -1.3, 0]}>
        <PlayerModel 
          isMoving={jumpPhase === 'none' ? isMoving : true} 
          moveDir={jumpPhase === 'none' ? moveDir : jumpLock.current.dir} 
          jumpPhase={jumpPhase} 
          isSprinting={jumpPhase === 'none' ? !isWalking : jumpLock.current.sprint} 
          config={animConfig}
        />
      </group>
    </RigidBody>
  );
}
