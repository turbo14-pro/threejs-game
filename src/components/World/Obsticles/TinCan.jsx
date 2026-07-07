import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RigidBody, CylinderCollider, useRapier } from '@react-three/rapier';
import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

// Preload assets – the GLB model is only needed for the shape (we'll use geometry directly)
useGLTF.preload('/models/tincan.glb');
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
        color="#c0c0c0"
        metalness={0.3}
        roughness={0.0}
      />
    ),
    []
  );

  // Approximate tin‑can dimensions.
  const radius = 4; // half‑width
  const height = 10;

  return (
    <group position={position} rotation={rotation}>
      {/* Side surface */}
      <mesh geometry={new THREE.CylinderGeometry(radius, radius, height, 32, 1, true)}>
        {sideMaterial}
      </mesh>
      {/* Top metallic cap */}
      <mesh geometry={new THREE.CircleGeometry(radius, 32)} rotation={[-Math.PI / 2, 0, 0]} position={[0, height / 2, 0]}>
        {metalMaterial}
      </mesh>
      {/* Bottom metallic cap */}
      <mesh geometry={new THREE.CircleGeometry(radius, 32)} rotation={[Math.PI / 2, 0, 0]} position={[0, -height / 2, 0]}>
        {metalMaterial}
      </mesh>
    </group>
  );
}

/**
 * Physics collider component for a Tin Can.
 * Dynamic RigidBody with a CylinderCollider matching the visual dimensions.
 * The visual TinCan mesh is parented inside so it follows physics.
 * Falls from spawn height (y=30) onto the table. Respawns if it falls below y=-100.
 */
export function TinCanPhysics({ position, rotation, color, mass = 1, linearDamping = 0.1, angularDamping = 0.05 }) {
  const halfHeight = 5;  // height 12 / 2
  const radius = 4;
  const rigidRef = useRef();
  const colliderRef = useRef();

  // Debug: log actual collider shape type after creation
  const logged = useRef(false);
  const { world } = useRapier();
  useFrame(() => {
    if (logged.current || !colliderRef.current) return;
    logged.current = true;
    const c = world.getCollider(colliderRef.current.handle);
    console.log('[TinCan] Shape type:', c.shapeType());
    console.log('[TinCan] Has _shape:', !!c._shape, 'keys:', Object.keys(c._shape || {}));
    console.log('[TinCan] RigidBody translation:', rigidRef.current?.translation());
  });

  // Respawn if the can falls below the arena
  useFrame(() => {
    if (!rigidRef.current) return;
    const y = rigidRef.current.translation().y;
    if (y < -100) {
      // Reset to spawn position (same x/z, y=30) with zero velocity
      rigidRef.current.setTranslation({ x: position[0], y: 30, z: position[2] }, true);
      rigidRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

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
      >
      <CylinderCollider args={[halfHeight, radius]} ref={colliderRef} />
      <TinCan position={[0, 0, 0]} rotation={[0, 0, 0]} color={color} />
    </RigidBody>
  );
}
