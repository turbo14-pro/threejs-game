import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, CylinderCollider, CapsuleCollider, CuboidCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';
import { soundManager } from '../../utils/SoundManager';

const direction = new THREE.Vector3();
const frontVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const camPos = new THREE.Vector3();

export default function PlayerController({ sendUpdate }) {
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
  const selectedSkin = useGameStore(state => state.player.selectedSkin);
  const addShockwave = useGameStore(state => state.addShockwave);
  const knockbackCount = useGameStore(state => state.knockbackCount);
  const knockbackDir = useGameStore(state => state.knockbackDir);

  // --- PLAYER STATE ---
  const [isSliding, setIsSliding] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [moveDir, setMoveDir] = useState('for');
  const [jumpPhase, setJumpPhase] = useState('none'); // none, launch, air, land
  const animConfig = useGameStore(state => state.player.playerAnimations);
  const setPlayerAnimations = useGameStore(state => state.setPlayerAnimations);
  const targetRotationY = useRef(Math.PI);
  const [hasDoubleJumped, setHasDoubleJumped] = useState(false);
  const netTick = useRef(0);
  const netAccumulator = useRef(0);
  const inputHistory = useRef([]); // [{ tick, pos, input, camRot }]
  const lastProcessedTick = useRef(0);

  // --- RECONCILIATION LISTENER ---
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(
      state => state.lastServerState,
      (serverState) => {
        if (!serverState || !rigidBodyRef.current) return;
        
        // Find the history entry for this tick
        const historyEntry = inputHistory.current.find(e => e.tick === serverState.tick);
        if (!historyEntry) return;

        const pos = historyEntry.pos;
        const diff = Math.sqrt(
          Math.pow(pos.x - serverState.pos[0], 2) +
          Math.pow(pos.z - serverState.pos[2], 2)
        );

        // Increase threshold to 0.5m to allow for tick-rate jitter
        if (diff > 0.5) {
          console.log(`[Reconciliation] Desync detected at tick ${serverState.tick}! Diff: ${diff.toFixed(2)}m. Snapping...`);
          
          // Authoritative Snap
          rigidBodyRef.current.setTranslation({ 
            x: serverState.pos[0], 
            y: serverState.pos[1], 
            z: serverState.pos[2] 
          }, true);
          
          // Match velocity to prevent post-snap drift
          if (serverState.vel) {
            rigidBodyRef.current.setLinvel(serverState.vel, true);
          }
        }

        // Cleanup old history
        inputHistory.current = inputHistory.current.filter(e => e.tick > serverState.tick);
      }
    );
    return unsubscribe;
  }, []);

  // --- REFS / TIMERS ---
  const slideTimer = useRef(0);
  const lastDamageTime = useRef(0);
  const jumpTimer = useRef(0);
  const physicsJumpTriggered = useRef(false);
  const jumpLock = useRef({ sprint: false, dir: 'for' });
  const lastFootstepTime = useRef(0);
  const prevJumpingInput = useRef(false);
  const externalForce = useRef(new THREE.Vector3());
  const worldVelocityRef = useRef(new THREE.Vector3());
  const preImpactVelocity = useRef(new THREE.Vector3());

  // Load animation configuration dynamically
  useEffect(() => {
    if (animConfig) return; // Already loaded!
    fetch('/skins/animations.json')
      .then(res => res.json())
      .then(d => setPlayerAnimations(d.Melee))
      .catch(err => console.error("PlayerController failed to load animations.json", err));
  }, [animConfig, setPlayerAnimations]); // Lock animation states during jump phase

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

  // Touch zoom management
  const DEFAULT_ZOOM = 12;
  const intendedZoom = useRef(12);   // What the user actually wants (pre-collision)
  const lastPinchTime = useRef(0);   // Timestamp of last pinch/scroll for auto-return
  const isTouchDevice = useRef('ontouchstart' in window || navigator.maxTouchPoints > 0);

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
      intendedZoom.current = zoomDistance.current;
      lastPinchTime.current = Date.now();
    };

    // Pinch-to-zoom only (camera joystick handles rotation via store)
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        lastPinchDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastPinchTime.current = Date.now();
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (lastPinchDist.current - dist) * 0.05;
        zoomDistance.current = Math.max(2, Math.min(25, zoomDistance.current + delta));
        intendedZoom.current = zoomDistance.current;
        lastPinchDist.current = dist;
        lastPinchTime.current = Date.now();
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
          rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);

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
          targetRotationY.current = Math.PI;

          if (playerGroupRef.current) {
            playerGroupRef.current.rotation.y = Math.PI; // Match targetRotationY
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

  // --- SKIN SYNC ---
  // Sends our skin to the server whenever it changes.
  // Because the server now "merges" data, this one-off packet 
  // will update our skin in the global list without overwriting our position.
  useEffect(() => {
    if (sendUpdate && selectedSkin) {
      console.log("👗 Sending Skin Update to Server:", selectedSkin);
      sendUpdate({ skin: selectedSkin });
    }
  }, [selectedSkin, sendUpdate]);

  // Knockback effect listener
  useEffect(() => {
    if (knockbackCount > 0 && rigidBodyRef.current) {
      const setIsStunned = useGameStore.getState().setIsStunned;
      setIsStunned(true);
      
      const forceMultiplier = 250;
      // 1. Horizontal push
      externalForce.current.set(
        knockbackDir.x * forceMultiplier,
        0,
        knockbackDir.z * forceMultiplier
      );
      
      // 2. Vertical pop
      const currentVel = rigidBodyRef.current.linvel();
      rigidBodyRef.current.setLinvel({
        x: currentVel.x,
        y: 55,
        z: currentVel.z
      }, true);
      
      soundManager.playPositional('hit', playerGroupRef.current, 0.5);

      // Yield control for 1.2s to allow the flight to finish
      setTimeout(() => setIsStunned(false), 1200);
    }
  }, [knockbackCount]);

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
      targetRotationY.current = Math.PI;

      if (playerGroupRef.current) {
        playerGroupRef.current.rotation.y = Math.PI; // Match targetRotationY
      }
      return;
    }

    // Input Aggregation (Keyboard + Mobile)
    const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (mobileInput.x || 0);
    const moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0);
    const walkingInput = !!(keys.walk || mobileInput.walk);
    const jumpingInput = !!(keys.jump || mobileInput.jump);
    const slidingInput = !!(keys.slide || mobileInput.slide);

    // Reliable ground detection via ShapeCast (SphereCast)
    // Replaces the single thin RayCast so that standing on edges works correctly
    let currentlyGrounded = false;
    let veryCloseToGround = false;

    try {
      // Lazy initialize the ground check shape once
      if (playerGroupRef.current && !playerGroupRef.current.userData._groundShape) {
        playerGroupRef.current.userData._groundShape = new rapier.Ball(0.3); // Match player radius
      }
      
      if (playerGroupRef.current?.userData?._groundShape) {
        const groundShape = playerGroupRef.current.userData._groundShape;
        const shapeRotation = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
        const rayDirG = { x: 0, y: -1, z: 0 };

        // 1. Glue Sensor (Long): Keeps physics stable
        const glueHit = world.castShape(
          playerPos,
          shapeRotation,
          rayDirG,
          groundShape,
          0.0,
          2.6, // Distance from center for 5m pill (bottom is at -2.5)
          true,
          null,
          0x00010001,
          null,
          rigidBodyRef.current
        );
        currentlyGrounded = glueHit !== null;

        // 2. Impact Sensor (Short): Only triggers landing animation when very close to ground
        const impactHit = world.castShape(
          playerPos,
          shapeRotation,
          rayDirG,
          groundShape,
          0.0,
          2.6,
          true,
          null,
          0x00010001,
          null,
          rigidBodyRef.current
        );
        veryCloseToGround = impactHit !== null;
      }
    } catch (e) {
      // Fallback if castShape fails for some reason during hot-reload
      currentlyGrounded = false;
    }

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
    
    // DEBUG: Only log if we are moving or if we just stopped
    if (moving || isMoving) {
      // console.log(`[Move Debug] moveX: ${moveX.toFixed(2)}, moveZ: ${moveZ.toFixed(2)}, moving: ${moving}`);
    }

    // 2. SLIDE LOGIC
    if (slidingInput && !isSliding && currentlyGrounded && moving && !walkingInput) {
      setIsSliding(true);
      slideTimer.current = 0.6; // 0.6s slide
      // Add a burst of speed
      direction.multiplyScalar(1.5);
      // Ensure we don't carry upward momentum when starting a slide
      const curVel = rigidBodyRef.current.linvel();
      rigidBodyRef.current.setLinvel({ x: curVel.x, y: Math.min(curVel.y, 0), z: curVel.z }, true);
      // Force player down a little to stay close to ground
      // removed duplicate curVel declaration
      rigidBodyRef.current.setLinvel({ x: curVel.x, y: -5, z: curVel.z }, true);
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
      setHasDoubleJumped(false); // Reset double jump
      // Only allow landing if moving DOWN and VERY CLOSE to the ground
      if ((currentPhase === 'air' || currentPhase === 'doublejump') && currentVelocity.y < 0 && veryCloseToGround) {
        currentPhase = 'land';
        const landDuration = (animConfig?.jump?.landFrames || 10) / (30 * 1.6);
        jumpTimer.current = landDuration;
        soundManager.playPositional('land', playerGroupRef.current, 0.5);
      }

      if (currentPhase === 'land' || currentPhase === 'none') {
        if (jumpingInput && Math.abs(currentVelocity.y) < 2.0 && animConfig) {
          const config = !walkingInput ? animConfig.run_jump : animConfig.jump;
          currentPhase = 'launch';
          jumpTimer.current = config.launchFrames / 30; // Use JSON values
          physicsJumpTriggered.current = false;
          soundManager.playPositional('jump', playerGroupRef.current, 0.4);
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
          rigidBodyRef.current.setLinvel({ x: currentVelocity.x, y: 38, z: currentVelocity.z }, true);
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

      // DOUBLE JUMP LOGIC
      if (currentPhase === 'air' && jumpingInput && !prevJumpingInput.current && !hasDoubleJumped) {
        rigidBodyRef.current.setLinvel({ x: currentVelocity.x, y: 35, z: currentVelocity.z }, true);
        setHasDoubleJumped(true);
        currentPhase = 'doublejump';
        
        const isBack = jumpLock.current.dir === 'bac';
        const djConfig = isBack ? animConfig?.doublejump_back : animConfig?.doublejump;
        const frames = djConfig?.frames || 15;
        jumpTimer.current = frames / 30;
        
        soundManager.playPositional('jump', playerGroupRef.current, 0.3); // Add double jump sound
      }

      if (currentPhase === 'doublejump') {
        jumpTimer.current -= delta;
        if (jumpTimer.current <= 0) {
          currentPhase = 'air';
        }
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
      if (jumpPhase === 'none' && (currentPhase === 'launch' || currentPhase === 'air' || currentPhase === 'doublejump')) {
        jumpLock.current = { sprint: !walkingInput, dir: moveDir };
      }
      setJumpPhase(currentPhase);
    }

    // Apply Horizontal Velocity ONLY (preserve vertical velocity)
    // ADDITION: Apply and decay external forces (knockback)
    const finalX = direction.x + externalForce.current.x;
    const finalZ = direction.z + externalForce.current.z;
    const finalY = rigidBodyRef.current.linvel().y;
    
    rigidBodyRef.current.setLinvel({ x: finalX, y: finalY, z: finalZ }, true);

    // Decay the external force quickly
    externalForce.current.multiplyScalar(Math.max(0, 1 - 8 * delta));
    if (externalForce.current.lengthSq() < 0.1) externalForce.current.set(0, 0, 0);

    // Sync movement direction for animations with hysteresis
    if (moving !== isMoving) setIsMoving(moving);
    if (walkingInput !== isWalking) setIsWalking(walkingInput);

    // FOOTSTEP SOUNDS
    if (currentlyGrounded && moving && currentPhase === 'none') {
      const footstepDelay = walkingInput ? 400 : 250; // Faster frequency when sprinting
      if (Date.now() - lastFootstepTime.current > footstepDelay) {
        soundManager.playPositional('footstep', playerGroupRef.current, 0.2, 3);
        lastFootstepTime.current = Date.now();
      }
    }

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
        targetRotationY.current = rotationY.current + Math.PI;
      } else {
        currentMoveDir = 'for';
        targetRotationY.current = Math.atan2(direction.x, direction.z);
      }
    }

    // Smoothly rotate the visual mesh towards the target heading
    if (playerGroupRef.current) {
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotationY.current);
      playerGroupRef.current.quaternion.slerp(targetQuat, 0.2);
    }

    if (currentMoveDir !== moveDir) setMoveDir(currentMoveDir);

    // --- NETWORKING: BROADCAST INPUT & POSITION ---
    // Increment tick based on 30Hz rate (33.3ms) to match server
    netAccumulator.current = (netAccumulator.current || 0) + delta;
    if (netAccumulator.current >= 0.0333) {
      netTick.current = (netTick.current || 0) + 1;
      netAccumulator.current -= 0.0333;
      
      const currentInput = {
      w: !!keys.forward,
      a: !!keys.left,
      s: !!keys.backward,
      d: !!keys.right,
      jump: jumpingInput,
      walk: walkingInput,
      slide: slidingInput
    };

    if (sendUpdate) {
      // 1. Send INPUT (Authoritative Phase 2)
      // We send this every frame for maximum responsiveness
      sendUpdate({
        type: 'input',
        tick: netTick.current,
        input: currentInput,
        camRot: rotationY.current
      });

      // 2. Send LEGACY POSITION (Phase 1/2 Bridge)
      const pos = rigidBodyRef.current.translation();
      
      if (netTick.current % 3 === 0) {
        sendUpdate({
          pos: [pos.x, pos.y, pos.z],
          rot: targetRotationY.current,
          anim: {
            mv: moving,
            dir: currentMoveDir,
            jp: currentPhase, 
            spr: !walkingInput
          }
        });
      }
      
      // 3. Record History for Reconciliation
      inputHistory.current.push({
        tick: netTick.current,
        pos: { x: pos.x, y: pos.y, z: pos.z },
        input: currentInput,
        camRot: rotationY.current
      });
      
      // Keep history buffer manageable (2 seconds @ 60fps = 120 entries)
      if (inputHistory.current.length > 120) {
        inputHistory.current.shift();
      }
    }
    }

    // ----------------------------------------------------
    // OPTIMIZED 3RD PERSON CAMERA LOGIC (Rubber-banding & Raycast)
    // ----------------------------------------------------

    // Apply camera joystick input from store (touch devices)
    const camInput = useGameStore.getState().cameraInput;
    if (camInput.x !== 0 || camInput.y !== 0) {
      rotationY.current += camInput.x;
      rotationX.current += camInput.y;
      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));
      // Reset after applying so it doesn't compound
      useGameStore.getState().setCameraInput({ x: 0, y: 0 });
    }

    // 1. Smooth the raw inputs
    const rawRotY = isNaN(rotationY.current) ? 0 : rotationY.current;
    const rawRotX = isNaN(rotationX.current) ? 0 : rotationX.current;
    const rawZoom = isNaN(zoomDistance.current) ? 12 : zoomDistance.current;

    smoothRotY.current = THREE.MathUtils.damp(smoothRotY.current, rawRotY, 20, delta);
    smoothRotX.current = THREE.MathUtils.damp(smoothRotX.current, rawRotX, 20, delta);
    smoothZoom.current = THREE.MathUtils.damp(smoothZoom.current, rawZoom, 15, delta); // Expected zoom

    // 2. Determine camera direction vector
    const cameraOffset = new THREE.Vector3(0, 0, 1);
    cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), smoothRotX.current);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), smoothRotY.current);
    rayDirection.copy(cameraOffset).normalize();

    // 3. Define the Ray Origin (Target Point) with smoothing
    // We smooth the anchor point to give a "cinematic" follow feel to the camera's orbit center.
    if (!camera.userData.smoothedTarget) camera.userData.smoothedTarget = new THREE.Vector3().copy(playerPos);
    const targetYOffset = 2.2;
    const shoulderOffset = 2; // Shift camera to the right

    // Calculate the right vector for the shoulder offset
    const right = new THREE.Vector3().set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), smoothRotY.current);

    const currentTarget = new THREE.Vector3(
      playerPos.x + right.x * shoulderOffset,
      playerPos.y + targetYOffset,
      playerPos.z + right.z * shoulderOffset
    );

    camera.userData.smoothedTarget.lerp(currentTarget, 1 - Math.exp(-15 * delta));
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
      camera.userData.currentZoom = DEFAULT_ZOOM;
    }

    // Touch auto-return: after 3s of no pinch/scroll on touch devices, drift back to default
    if (isTouchDevice.current && Date.now() - lastPinchTime.current > 3000) {
      intendedZoom.current = THREE.MathUtils.damp(
        intendedZoom.current, DEFAULT_ZOOM, 2, delta
      );
      zoomDistance.current = intendedZoom.current;
    }

    if (camera.userData.currentZoom > maxSafeDist) {
      // Collision detected — snap/fast-lerp inwards immediately
      camera.userData.currentZoom = THREE.MathUtils.damp(
        camera.userData.currentZoom, maxSafeDist, 30, delta
      );
    } else {
      // Path is clear — recover toward intended zoom (what the user set)
      // Fast recovery so camera doesn't stay close after a jump
      camera.userData.currentZoom = THREE.MathUtils.damp(
        camera.userData.currentZoom, intendedZoom.current, 8, delta
      );
      // Also clamp to maxSafeDist so we never go through geometry
      camera.userData.currentZoom = Math.min(camera.userData.currentZoom, maxSafeDist);
    }

    // Prevent NaN corruption
    if (isNaN(camera.userData.currentZoom) || !isFinite(camera.userData.currentZoom)) {
      camera.userData.currentZoom = DEFAULT_ZOOM;
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

    // Look past the shoulder into the distance so the crosshair points at the world
    const lookDistance = 100;
    const lookTarget = new THREE.Vector3().copy(rayOrigin).addScaledVector(rayDirection, -lookDistance);
    camera.lookAt(lookTarget);

    // Track World Velocity for Newtonian Prediction
    const currentVel = rigidBodyRef.current.linvel();
    worldVelocityRef.current.set(currentVel.x, currentVel.y, currentVel.z);

    // Memory: Save velocity from frame BEFORE impact
    if (isSliding && !preImpactVelocity.current.lengthSq()) {
      preImpactVelocity.current.copy(worldVelocityRef.current);
    } else if (!isSliding) {
      preImpactVelocity.current.set(0, 0, 0);
    }

    prevJumpingInput.current = jumpingInput;

    // --- VICTIM AUTHORITY ---
    // If we were recently hit, we need to send our position more frequently 
    // to ensure everyone else's "Magnet" knows where we actually landed.
    if (knockbackCount > 0 && netTick.current % 2 === 0) {
      const pos = rigidBodyRef.current.translation();
      sendUpdate({
        pos: [pos.x, pos.y, pos.z],
        rot: rotationY.current,
        skin: selectedSkin
      });
    }
  });

  /**
   * NEWTONIAN KNOCKBACK
   * Applies a physical impulse to the character.
   */
  const triggerKnockback = (direction, force = 12) => {
    if (!rigidBodyRef.current) return;
    
    // Apply World-Space Impulse
    rigidBodyRef.current.applyImpulse({
      x: direction.x * force,
      y: 8, // Fixed upward pop for "Real Time" feel
      z: direction.z * force
    }, true);

    // Visual/Audio Feedback
    soundManager.playPositional('hit', playerGroupRef.current, 0.5);
  };

  const handleCollision = (e) => {
    if (!rigidBodyRef.current) return;

    const other = e.other.rigidBody;
    if (!other || other.userData?.type !== 'remote-player') return;

    // 1. I am the ATTACKER (I am sliding into someone)
    console.log("🛠️ LOCAL COLLISION: sliding:", isSliding, "target:", other.userData?.id);
    
    if (isSliding) {
      console.log("💥 Slide IMPACT! Launching Victim...");
      
      // 1. PHYSICAL KICK (Newtonian Interaction)
      // We apply an impulse to the other body locally on our screen
      // so they fly away instantly without waiting for the network.
      const attackerPos = rigidBodyRef.current.translation();
      const victimPos = other.translation();
      
      // 1. SIMPLE BLAST DIRECTION
      // Victim flies directly away from the attacker's center.
      const hitDir = new THREE.Vector3(
        victimPos.x - attackerPos.x,
        0,
        victimPos.z - attackerPos.z
      ).normalize();

      // Apply a massive impulse to launch them!
      const BLAST_POWER = 250;
      console.log("🚀 BLASTING Victim with Force:", BLAST_POWER);
      
      other.applyImpulse({
        x: hitDir.x * BLAST_POWER,
        y: 45, // Massive upward pop
        z: hitDir.z * BLAST_POWER
      }, true);

      // Trigger visual effects instantly for attacker
      const contactPoint = e.contactPoint;
      if (contactPoint) {
        addShockwave([contactPoint.x, contactPoint.y, contactPoint.z]);
      }

      // Send network message for server validation
      if (sendUpdate) {
        sendUpdate({
          type: 'impact',
          victimId: other.userData.id,
          dir: [hitDir.x, hitDir.y, hitDir.z],
          position: contactPoint ? [contactPoint.x, contactPoint.y, contactPoint.z] : null
        });
      }
    } 
    // 2. I am the VICTIM (A sliding player hit me!)
    else if (other.userData?.isSliding) {
      console.log("🛡️ Newtonian Victim-side Knockback!");
      
      const attackerPos = other.translation();
      const victimPos = rigidBodyRef.current.translation();
      
      // Calculate Glancing Blow (Offset Vector)
      const glanceDir = new THREE.Vector3(
        victimPos.x - attackerPos.x,
        0,
        victimPos.z - attackerPos.z
      ).normalize();

      // Blend Attacker Velocity with Glancing Blow
      const attackerVel = other.linvel();
      const velDir = new THREE.Vector3(attackerVel.x, 0, attackerVel.z).normalize();
      
      const finalDir = new THREE.Vector3()
        .copy(velDir).multiplyScalar(0.7) // 70% Forward
        .addScaledVector(glanceDir, 0.3)  // 30% Outward (Glance)
        .normalize();

      triggerKnockback(finalDir, 15);
    }
  };

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      position={[0, 105, 0]} 
      colliders={false} 
      lockRotations={true} 
      mass={1} 
      linearDamping={0.5}
      ccd={true} // Enable Continuous Collision for sliding
      collisionGroups={0x0002FFFF} 
      friction={0} 
      frictionCombineRule={1} 
      restitution={0}
      onCollisionEnter={handleCollision}
      userData={{ 
        type: 'player', 
        id: 'local', 
        isSliding 
      }}
    >
      {/* UNIFIED COLLIDER (Hidden Debug) */}
      <CapsuleCollider args={[1.5, 1]} position={[0, 0, 0]} friction={0} frictionCombineRule={1} restitution={0}>
        {/* <mesh>
          <capsuleGeometry args={[1.5, 1]} />
          <meshStandardMaterial color="purple" transparent opacity={0.3} depthTest={false} />
        </mesh> */}
      </CapsuleCollider>


      <group ref={playerGroupRef} name="localPlayer" position={[0, isSliding ? -2.8 : -2.5, 0]}>
        <PlayerModel
          isMoving={jumpPhase === 'none' ? isMoving : true}
          moveDir={jumpPhase === 'none' ? moveDir : jumpLock.current.dir}
          jumpPhase={jumpPhase}
          isSprinting={jumpPhase === 'none' ? !isWalking : jumpLock.current.sprint}
          isSliding={isSliding}
          config={animConfig}
        />
      </group>
    </RigidBody>
  );
}
