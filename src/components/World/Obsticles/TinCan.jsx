import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';

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
        metalness={0.0}
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
        metalness={1.0}
        roughness={0.2}
      />
    ),
    []
  );

  // Approximate tin‑can dimensions.
  const radius = 5; // half‑width
  const height = 12;

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
