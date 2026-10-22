import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGLTF, useTexture } from '@react-three/drei';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { extractGeometry, extractMaterial } from './obstacleUtils';

// Preload assets to avoid React Suspense triggering unmounts during physics simulation
useGLTF.preload('/models/cerealbox.glb');
useTexture.preload('/textures/cereal-munchies.webp');

/**
 * Custom hook to load and extract cereal box geometries, materials and textures.
 */
export function useCerealBoxAssets() {
  const model = useGLTF('/models/cerealbox.glb');
  const texture = useTexture('/textures/cereal-munchies.webp');
  texture.flipY = false;

  const assets = useMemo(() => {
    let geometry = null;
    let material = extractMaterial(model);

    if (model && model.scene) {
      const meshes = [];
      model.scene.traverse((child) => {
        if (child.isMesh) {
          child.updateMatrixWorld(true);
          const clonedGeo = child.geometry.clone();
          clonedGeo.applyMatrix4(child.matrix);
          meshes.push(clonedGeo);
        }
      });

      if (meshes.length > 0) {
        geometry = BufferGeometryUtils.mergeGeometries(meshes, false);
        geometry.center();
      }
    }

    // If merging failed, fallback to standard extraction
    if (!geometry) {
      geometry = extractGeometry(model);
      if (geometry) {
        geometry.center();
      }
    }

    let extent = new THREE.Vector3(15, 18, 6); // Default fallback (half of 30x36x12)
    if (geometry) {
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      if (bb) {
        extent = new THREE.Vector3().subVectors(bb.max, bb.min).multiplyScalar(0.5);
      }
    }

    return { geometry, material, texture, extent };
  }, [model, texture]);

  return assets;
}

/**
 * Visual mesh component for a Cereal Box.
 */
export function CerealBoxMesh({ position, rotation, color, geometry, material, texture }) {
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
      layers={0}
      frustumCulled={false}
    >
      <meshStandardMaterial
        map={texture}
        color={color}
        side={THREE.DoubleSide}
        onBeforeCompile={(shader) => {
          // 1. Prevent standard color multiplication by vColor in color_fragment
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            '// Mixing handled in map_fragment'
          );
          
          // 2. Inject custom two-sided mix logic at map_fragment inclusion point
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #if defined( USE_MAP )
              // Use vMapUv which is the standard UV for maps in newer Three.js versions
              vec4 logoTexel = texture2D( map, vMapUv );
            #else
              vec4 logoTexel = vec4( 0.0 );
            #endif
            
            vec3 finalBase = diffuseColor.rgb;
            #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
              finalBase = vColor.rgb;
            #endif
            
            if ( gl_FrontFacing ) {
              // Outside (Front): mix logo overlay with instance brand color
              diffuseColor.rgb = mix( finalBase, logoTexel.rgb, logoTexel.a );
            } else {
              // Inside (Back): Consistent Cardboard Tan
              diffuseColor.rgb = vec3( 0.76, 0.65, 0.5 ); 
            }
            
            // Force fully opaque result for solid boxes
            diffuseColor.a = 1.0;
            `
          );
        }}
      />
    </mesh>
  );
}

/**
 * Physics collider component for a Cereal Box.
 */
export function CerealBoxPhysics({ position, rotation, boxSize }) {
  const { x: w, y: h, z: d } = boxSize;
  const thickness = 0.5; // Thickness of the "cardboard"
  const t2 = thickness / 2; // Half-thickness for centering
  const doorHeight = 16; // Height of the doorway

  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation}
      collisionGroups={0x0001FFFF}
    >
      {/* 1. Floor - Inset by half thickness so top surface matches visual bottom */}
      <CuboidCollider args={[d/2, t2, w/2]} position={[0, -h/2 + t2, 0]} />

      {/* 2. Side Walls - Inset so outer surface matches visual width */}
      <CuboidCollider args={[t2, h/2, w/2]} position={[-d/2 + t2, 0, 0]} />
      <CuboidCollider args={[t2, h/2, w/2]} position={[d/2 - t2, 0, 0]} />

      {/* 3. Back Wall - Inset so visual depth matches */}
      <CuboidCollider args={[d/2, h/2, t2]} position={[0, 0, -w/2 + t2]} />

      {/* 4. Front Wall with Doorway - Inset so visual depth matches */}
      <CuboidCollider 
        args={[d/2, (h - doorHeight)/2, t2]} 
        position={[0, h/2 - (h - doorHeight)/2, w/2 - t2]} 
      />

      {/* NO TOP: Open for jumping in */}
    </RigidBody>
  );
}
