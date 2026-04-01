import React, { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useTexture, Environment } from '@react-three/drei';

export default function EnvironmentSetup() {
  const texture = useTexture('/skybox/skybox-kitchen.webp');
  
  // Use UV mapping properties for the visual mesh to ensure 'repeat' works
  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(2, 1); // Handles double horizontal wrap
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <>
      <ambientLight intensity={0.02} />
      <hemisphereLight args={[0xffffff, 0x444444, 0.4]} />
      <directionalLight 
        position={[100, 100, 100]} 
        intensity={1.5} 
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      
      {/* 
        We nest the visual sphere INSIDE the Environment component.
        This captures the custom wrap, squashed Y-scale, and position 
        into the global reflection map (IBL) and the scene background simultaneously.
      */}
      <Environment background resolution={512}>
        <mesh position={[0, 150, 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[900, 64, 32]} />
          <meshBasicMaterial 
            map={texture} 
            side={THREE.BackSide} 
            toneMapped={false} 
          />
        </mesh>
      </Environment>
    </>
  );
}
