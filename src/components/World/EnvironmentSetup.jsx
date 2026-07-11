import React, { useLayoutEffect, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture, Environment } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';

export default function EnvironmentSetup() {
  const { scene, gl } = useThree();
  const texture = useTexture('/skybox/skybox-kitchen.webp');
  const settings = useGameStore(state => state.settings);

  const cabinetColor = useMemo(() => new THREE.Color('#3b2d26'), []);

  const shadowMapSize = useMemo(() => {
    switch (settings.shadowQuality) {
      case 'Low': return 512;
      case 'Medium': return 1024;
      case 'High': return 2048;
      case 'Ultra': return 4096;
      default: return 1024;
    }
  }, [settings.shadowQuality]);

  useLayoutEffect(() => {
    if (!settings.skybox) {
      scene.background = cabinetColor;
    } else {
      scene.background = null;
    }
  }, [settings.skybox, scene, cabinetColor]);

  // Process equirectangular texture into a proper environment cubemap
  useEffect(() => {
    if (!texture) return;

    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();

    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;

    pmremGenerator.dispose();

    return () => {
      scene.environment = null;
      envMap.dispose();
    };
  }, [texture, scene, gl]);

  return (
    <>
      <ambientLight intensity={0.05} />
      <hemisphereLight args={[0xffffff, 0x444444, 0.4]} />

      {/* Single shadow-casting directional light. */}
      <directionalLight
        position={[200, 800, 200]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-250}
        shadow-camera-right={250}
        shadow-camera-top={250}
        shadow-camera-bottom={-250}
        shadow-camera-near={100}
        shadow-camera-far={2000}
        shadow-bias={-0.001}
        shadow-normalBias={0}
        shadow-radius={3}
      />

      {/* Fill light - no shadows */}
      <directionalLight
        position={[100, 800, 100]}
        intensity={0.4}
      />

      {/* Skybox background — only visible when enabled */}
      {settings.skybox && (
        <mesh position={[0, 150, 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[900, 64, 32]} />
          <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} depthWrite={true} fog={false} />
        </mesh>
      )}
    </>
  );
}
