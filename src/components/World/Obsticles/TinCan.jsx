import React, { useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { useTexture } from '@react-three/drei';
import { soundManager } from '../../../utils/SoundManager';
import { useFrame } from '@react-three/fiber';
import { debugLog } from '../../../utils/debugLog.js';
import { getLocalPlayerWorldPos } from '../items/PowerUpCoin.jsx';

useTexture.preload('/materials/sonicboom-beans.webp');

/**
 * TinCan obstacle – a cylinder with a label texture on its side and metallic caps.
 * A random colour is applied beneath the label for visual variety.
 */
const TinCan = forwardRef((props, ref) => {
  const { position, rotation, color } = props;
  const groupRef = useRef();
  
  useImperativeHandle(ref, () => groupRef.current);
  // Load the label texture (beans logo). FlipY is false because the texture is already oriented.
  const labelTex = useTexture('/materials/sonicboom-beans.webp');
  labelTex.flipY = false;
  labelTex.repeat.x = -1;
  labelTex.offset.x = 1;

  // Random side colour (the colour that shows under the transparent label).
  const sideColor = useMemo(() => new THREE.Color(color), [color]);

  // Materials – side material uses the label texture composited over the opaque colour.
  const sideMaterial = useMemo(
    () => (
      <meshStandardMaterial
        color={sideColor}
        map={labelTex}
        metalness={0.2}
        roughness={0.5}
        onBeforeCompile={(shader) => {
          // Prevent standard colour multiplication by vColor in colour_fragment
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            '// Mixing handled in map_fragment'
          );

          // Inject compositing logic at map_fragment inclusion point:
          // The texture's alpha defines where the label shows through;
          // the solid colour fills the transparent areas.
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #if defined( USE_MAP )
              vec4 logoTexel = texture2D( map, vMapUv );
            #else
              vec4 logoTexel = vec4( 0.0 );
            #endif

            vec3 finalBase = diffuseColor.rgb;
            #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
              finalBase = vColor.rgb;
            #endif

            // Mix: label over opaque colour
            diffuseColor.rgb = mix( finalBase, logoTexel.rgb, logoTexel.a );
            diffuseColor.a = 1.0;
            `
          );
        }}
      />
    ),
    [sideColor, labelTex]
  );

  const metalMaterial = useMemo(
    () => (
      <meshStandardMaterial
        color="#e0e0e0"
        metalness={0.9}
        roughness={0.15}
        envMapIntensity={2}
      />
    ),
    []
  );

  // Approximate tin‑can dimensions.
  const radius = 3.6; // half‑width
  const height = 10;

  // Concave dome cap – real tin lids press inward with a raised lip around the edge.
  const capGeometry = useMemo(() => {
    // Sphere section → flattened → flipped Y → concave
    const geo = new THREE.SphereGeometry(radius, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Flatten to 6% and negate Y so dome goes inward (concave)
      pos.setY(i, -pos.getY(i) * 0.06);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [radius]);

  // Raised lip ring around the cap edge
  const lipGeometry = useMemo(() => {
    return new THREE.TorusGeometry(radius, 0.1, 8, 32);
  }, [radius]);

  return (
      <group ref={groupRef} position={position} rotation={rotation}>
      {/* Side surface */}
      <mesh geometry={new THREE.CylinderGeometry(radius, radius, height, 32, 1, true)} castShadow receiveShadow>
        {sideMaterial}
      </mesh>
      {/* Top cap – concave dome + lip ring */}
      <group position={[0, height / 2, 0]}>
        <mesh geometry={capGeometry} castShadow receiveShadow>
          {metalMaterial}
        </mesh>
        <mesh geometry={lipGeometry} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          {metalMaterial}
        </mesh>
      </group>
      {/* Bottom cap – concave dome flipped + lip ring */}
      <group position={[0, -height / 2, 0]}>
        <mesh geometry={capGeometry} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
          {metalMaterial}
        </mesh>
        <mesh geometry={lipGeometry} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          {metalMaterial}
        </mesh>
      </group>
    </group>
  );
  });

  export { TinCan };

/**
 * Physics collider component for a Tin Can.
 * Dynamic RigidBody with a CylinderCollider matching the visual dimensions.
 * The visual TinCan mesh is parented inside so it follows physics.
 * Falls from spawn height (y=30) onto the table. Respawns if it falls below y=-100.
 */
export function TinCanPhysics({ position, rotation, color, mass = 1, linearDamping = 0.2, angularDamping = 0.0 }) {
  const halfHeight = 5;  // height 12 / 2
  const radius = 4;
  const rigidRef = useRef();
  const visualRef = useRef(); // Ref to the visual TinCan group for positional audio

  const groundHitRef = useRef(false);
  const lastSoundTime = useRef(0); // cooldown to prevent rapid re-fire on micro-bounces

  // Ground impact sound: detect when can lands on arena floor
  useFrame(() => {
    if (!rigidRef.current) return;
    const y = rigidRef.current.translation().y;
    const vel = rigidRef.current.linvel();
    // Don't make sounds if the can is 15m below the arena
    if (y < -15) {
      groundHitRef.current = false;
      return;
    }
    // Near floor (y ~ 5 = half height) and downward velocity just dropped
    // Only trigger when can is near ground level (y <= 8, slightly above halfHeight=5)
    if (vel.y < -1 && y <= 8 && !groundHitRef.current) {
      const now = Date.now();
      if (now - lastSoundTime.current < 300) { // 300ms margin against rapid micro-bounces
        groundHitRef.current = true;
        return;
      }
      lastSoundTime.current = now;
      groundHitRef.current = true;
      const impactVol = Math.min(Math.round((Math.abs(vel.y)) * 100) / 100/30, 1);
      const pos = rigidRef.current.translation();
            const playerPos = getLocalPlayerWorldPos();
            const dist = playerPos ? Math.sqrt(
              Math.pow(pos.x - playerPos.x, 2) +
              Math.pow(pos.y - playerPos.y, 2) +
              Math.pow(pos.z - playerPos.z, 2)
            ).toFixed(2) : 'N/A';
// debugLog("🥫 TinCan bounce! pos:", {x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2)}, "playerPos:", playerPos ? {x: playerPos.x.toFixed(2), y: playerPos.y.toFixed(2), z: playerPos.z.toFixed(2)} : 'N/A', "dist:", dist, "velY:", Math.abs(vel.y).toFixed(2), "vol:", impactVol);
                        try { if (soundManager && soundManager.listener && visualRef.current) soundManager.playPositional('metal-ground', visualRef.current, impactVol, 5, 1.0, 50, false); } catch (e) {}
    } else if (y > 10) {
      groundHitRef.current = false; // Reset when airborne
    }
  });

  // Respawn if the can falls below the arena
  useFrame(() => {
    if (!rigidRef.current) return;
    let y;
    try {
      y = rigidRef.current.translation().y;
    } catch { return; }
    // A NaN position means the WASM body is already corrupt — freeze it for
    // respawn instead of feeding NaN back into setTranslation (which traps).
    if (!Number.isFinite(y)) {
      try {
        rigidRef.current.setTranslation({ x: position[0], y: 30, z: position[2] }, true);
        rigidRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } catch {}
      groundHitRef.current = false;
      return;
    }
    if (y < -100) {
      const pos = rigidRef.current.translation();
          const playerPos = getLocalPlayerWorldPos();
          const dist = playerPos ? Math.sqrt(
            Math.pow(pos.x - playerPos.x, 2) +
            Math.pow(pos.y - playerPos.y, 2) +
            Math.pow(pos.z - playerPos.z, 2)
          ).toFixed(2) : 'N/A';
          debugLog("🥫 TinCan RESPAWN! was at:", {x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2)}, "playerPos:", playerPos ? {x: playerPos.x.toFixed(2), y: playerPos.y.toFixed(2), z: playerPos.z.toFixed(2)} : 'N/A', "dist:", dist, "-> new pos:", {x: position[0], y: 30, z: position[2]});
          rigidRef.current.setTranslation({ x: position[0], y: 30, z: position[2] }, true);
          rigidRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rigidRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
          groundHitRef.current = false; // Prevent sound on respawn before hitting ground
          return;
        }
  });

  // Push the can away when the player slides into it
  const handleCollision = useCallback((e) => {
    try {
      if (!rigidRef.current) return;
      const other = e.other.rigidBody;
      if (!other) return;

      // Snapshot positions/velocities into plain numbers immediately.
      // Holding live WASM refs across setVolume/playPositional re-enters the
      // Rapier JS wrapper and trips "recursive use ... unsafe aliasing".
      let canPos, playerPos, playerVel, canVel;
      try {
        const c = rigidRef.current.translation();
        const p = other.translation();
        const v = other.linvel();
        const cv = rigidRef.current.linvel();
        if (![c.x, c.y, c.z, p.x, p.y, p.z, v.x, v.z, cv.x, cv.z].every(Number.isFinite)) return;
        canPos = { x: c.x, y: c.y, z: c.z };
        playerPos = { x: p.x, y: p.y, z: p.z };
        playerVel = { x: v.x, z: v.z };
        canVel = { x: cv.x, z: cv.z };
      } catch { return; }

    // Only apply impact when the player is sliding; otherwise just push gently
    const isSliding = other.userData?.isSliding || false;

    const localPlayerPos = getLocalPlayerWorldPos();
    const hitDist = localPlayerPos ? Math.sqrt(
      Math.pow(canPos.x - localPlayerPos.x, 2) +
      Math.pow(canPos.y - localPlayerPos.y, 2) +
      Math.pow(canPos.z - localPlayerPos.z, 2)
    ).toFixed(2) : 'N/A';

    if (isSliding) {
      const now = Date.now();
      if (now - lastSoundTime.current < 300) return;
      lastSoundTime.current = now;

      // Direction from player to can — guard zero-length (normalize() of 0-vector = NaN,
      // and NaN in applyImpulse traps WASM with "unreachable").
      const dirX = canPos.x - playerPos.x;
      const dirZ = canPos.z - playerPos.z;
      const dirLen = Math.hypot(dirX, dirZ);
      if (!Number.isFinite(dirLen) || dirLen < 1e-4) return;
      const dir = new THREE.Vector3(dirX / dirLen, 0, dirZ / dirLen);

      const velDir = new THREE.Vector3(playerVel.x, 0, playerVel.z);
      const speed = velDir.length();
      if (!Number.isFinite(speed)) return;

      const velLen = Math.hypot(playerVel.x, playerVel.z);
      const velNX = velLen > 1e-4 ? playerVel.x / velLen : 0;
      const velNZ = velLen > 1e-4 ? playerVel.z / velLen : 0;
      const finalDir = new THREE.Vector3()
        .copy(dir).multiplyScalar(0.7)
        .addScaledVector(new THREE.Vector3(velNX, 0, velNZ), 0.3);
      if (finalDir.lengthSq() < 1e-8) finalDir.copy(dir);
      finalDir.normalize();

      const slideMultiplier = other.userData?.slideMultiplier || 1;
      const safeSlideMult = Number.isFinite(slideMultiplier) ? slideMultiplier : 1;
      const force = Math.max(speed * 800 * safeSlideMult, 25);
      if (!Number.isFinite(force)) return;
      // Clamp the impulse — a corrupt speed (1e10+) traps WASM.
      const safeForce = Math.min(force, 50000);

      // Volume based on horizontal slide speed (0-1), no floor so gentle slides are quiet
      const impactVol = Math.min(Math.round((speed) * 100) / 100 / 30, 1);
      const safeImpactVol = Number.isFinite(impactVol) ? Math.max(0, Math.min(1, impactVol)) : 0;
      try { debugLog("🥫 TinCan hit! speed:", speed, "multiplier:", slideMultiplier, "force:", force, "vol:", safeImpactVol); } catch {}
      try { if (soundManager && soundManager.listener && safeImpactVol > 0.05 && visualRef.current) soundManager.playPositional('metal-hit', visualRef.current, safeImpactVol, 5, 1.0, 50, false); } catch (e) {}

      try {
        if ([finalDir.x, finalDir.z].every(Number.isFinite)) {
          rigidRef.current.applyImpulse({
            x: finalDir.x * safeForce,
            y: safeForce,
            z: finalDir.z * safeForce
          }, true);
        }
      } catch {}
    } else {
      // Non-slide collision (can-object, walking into can): gentle push with velocity-based sound
      const now = Date.now();
      const gDirX = canPos.x - playerPos.x;
      const gDirZ = canPos.z - playerPos.z;
      const gLen = Math.hypot(gDirX, gDirZ);
      const dir = gLen > 1e-4
        ? new THREE.Vector3(gDirX / gLen, 0, gDirZ / gLen)
        : new THREE.Vector3(0, 0, 1);
      if (now - lastSoundTime.current < 300) {
        // Still apply gentle push even if sound is on cooldown
        try {
          rigidRef.current.applyImpulse({
            x: dir.x * 15,
            y: 2,
            z: dir.z * 15
          }, true);
        } catch {}
        return;
      }
      lastSoundTime.current = now;

      // Relative impact velocity between can and other object (snapshotted above —
      // do NOT call other.linvel() again here; re-entering WASM mid-callback aliases).
      const relVel = new THREE.Vector3(
        canVel.x - playerVel.x,
        0,
        canVel.z - playerVel.z
      );
      const impactSpeed = relVel.length();
      if (!Number.isFinite(impactSpeed)) return;

      // Gentle push force
      try {
        rigidRef.current.applyImpulse({
          x: dir.x * 15,
          y: 2,
          z: dir.z * 15
        }, true);
      } catch {}

      // Volume based on relative impact speed (0-1). Divisor 20 = more sensitive than 30.
      // Quiet floor so very gentle taps are silent.
      const impactVol = Math.min(Math.round((impactSpeed) * 100) / 100 / 15, 1);
      const safeVol = Number.isFinite(impactVol) ? Math.max(0, Math.min(1, impactVol)) : 0;
      const hitLabel = safeVol > 0.5 ? "hard" : safeVol > 0.2 ? "medium" : "gentle";
      try { debugLog("🥫 TinCan hit (" + hitLabel + ")! speed:", impactSpeed, "vol:", safeVol); } catch {}
      try { if (soundManager && soundManager.listener && safeVol > 0.05 && visualRef.current) soundManager.playPositional('metal-hit', visualRef.current, safeVol, 5, 1.0, 50, false); } catch (e) {}
    }
    } catch { /* never let a collision callback crash the frame */
    }
  }, []);

  return (
      <RigidBody
        ref={rigidRef}
        type="dynamic"
        position={position}
        rotation={rotation}
        colliders={false}
        collisionGroups={0x0001FFFF}
        mass={mass}
        linearDamping={linearDamping}
        angularDamping={angularDamping}
        onCollisionEnter={handleCollision}
        userData={{ type: 'tinCan' }}
      >
      <CylinderCollider args={[halfHeight, radius]} />
            <TinCan ref={visualRef} position={[0, 0, 0]} rotation={[0, 0, 0]} color={color} />
    </RigidBody>
  );
}
