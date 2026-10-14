import React, { useLayoutEffect, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture, Environment } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';

export default function EnvironmentSetup() {
  const { scene } = useThree();
  const texture = useTexture('/skybox/skybox-kitchen.webp');
  const settings = useGameStore(state => state.settings);

  const cabinetColor = useMemo(() => new THREE.Color('#cfc1ad'), []);

  const shadowMapSize = useMemo(() => {
    switch (settings.shadowQuality) {
      case 'Low': return 512;
      case 'Medium': return 1024;
      case 'High': return 2048;
      case 'Ultra': return 4096;
      default: return 1024;
    }
  }, [settings.shadowQuality]);

  // Configure texture for equirectangular mapping
  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(2, 1);
      texture.needsUpdate = true;
    }
  }, [texture]);

  useLayoutEffect(() => {
    if (!settings.skybox) {
      scene.background = cabinetColor;
      // Re-apply fog since setting scene.background can reset it
      scene.fog = new THREE.FogExp2('#ac9b82', 0.004);
    } else {
      // Don't set background to null - let the skybox mesh show through
      scene.background = null;
      scene.fog = new THREE.FogExp2('#ac9b82', 0.004);
    }
  }, [settings.skybox, scene, cabinetColor]);

  return (
    <>
      <ambientLight intensity={0.0} />
      <hemisphereLight args={[0xccffff, 0x000000, 0.15]} />

      {/* Single shadow-casting directional light. */}
      <directionalLight
        position={[200, 400, 500]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-500}
        shadow-camera-right={500}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-camera-near={100}
        shadow-camera-far={1200}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      {/* Fill light - no shadows 
      <directionalLight
        position={[100, 800, 100]}
        intensity={0.0}
      />
      */}

      {/* Skybox background — only visible when enabled */}
      {settings.skybox && texture && (
        <mesh position={[0, 150, 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[900, 64, 32]} />
          <meshBasicMaterial
            map={texture}
            side={THREE.BackSide}
            toneMapped={false}
            depthWrite={true}
            fog={false}
          />
        </mesh>
      )}
    </>
  );
}
