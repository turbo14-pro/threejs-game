import React, { useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

useTexture.preload('/materials/sonicboom-beans.webp');

/**
 * TinCan obstacle – a cylinder with a label texture on its side and metallic caps.
 * A random colour is applied beneath the label for visual variety.
 */
export function TinCan({ position, rotation, color }) {
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
    <group position={position} rotation={rotation}>
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
}

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

  // Respawn if the can falls below the arena
  useFrame(() => {
    if (!rigidRef.current) return;
    const y = rigidRef.current.translation().y;
    if (y < -100) {
      rigidRef.current.setTranslation({ x: position[0], y: 30, z: position[2] }, true);
      rigidRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  // Push the can away when the player slides into it
  const handleCollision = useCallback((e) => {
    if (!rigidRef.current) return;
    const other = e.other.rigidBody;
    if (!other || other.userData?.type !== 'player' || !other.userData?.isSliding) return;

    const canPos = rigidRef.current.translation();
    const playerPos = other.translation();

    // Direction from player to can
    const dir = new THREE.Vector3(
      canPos.x - playerPos.x,
      0,
      canPos.z - playerPos.z
    ).normalize();

    // Player velocity contributes to the push direction
    const playerVel = other.linvel();
    const velDir = new THREE.Vector3(playerVel.x, 0, playerVel.z);
    const speed = velDir.length();

    // Blend: 70% direction-away + 30% player velocity direction
    const finalDir = new THREE.Vector3()
      .copy(dir).multiplyScalar(0.7)
      .addScaledVector(velDir.normalize(), 0.3)
      .normalize();

    // Scale force by player speed (min threshold so even slow hits move the can)
    const force = Math.max(speed * 800, 25);

    rigidRef.current.applyImpulse({
      x: finalDir.x * force,
      y: force,  // slight upward pop
      z: finalDir.z * force
    }, true);
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
      >
      <CylinderCollider args={[halfHeight, radius]} />
      <TinCan position={[0, 0, 0]} rotation={[0, 0, 0]} color={color} />
    </RigidBody>
  );
}
