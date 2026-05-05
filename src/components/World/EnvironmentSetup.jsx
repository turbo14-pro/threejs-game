import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture, Environment } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';

export default function EnvironmentSetup() {
  const { scene } = useThree();
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

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <>
      <ambientLight intensity={0.001} />
      <hemisphereLight args={[0xffffff, 0x444444, 0.4]} />
      {/* Existing angled light - moved higher for a tighter angle */}
      <directionalLight 
        key={`angled-${settings.shadowQuality}`}
        position={[200, 800, 200]} 
        intensity={0.8} 
        castShadow={settings.shadowQuality !== 'None'}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-camera-near={0.5}
        shadow-camera-far={2000}
        shadow-bias={-0.0001}
        shadow-normalBias={0.4}
        shadow-radius={4}
      />
      {/* Top-down light for feet shadows - also tighter */}
      <directionalLight 
        key={`top-${settings.shadowQuality}`}
        position={[100, 800, 100]} 
        intensity={0.4} 
        castShadow={['High', 'Ultra'].includes(settings.shadowQuality)}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-camera-near={0.5}
        shadow-camera-far={2000}
        shadow-bias={-0.0001}
        shadow-normalBias={0.4}
        shadow-radius={6}
      />

      {settings.skybox && (
        <>
          <Environment map={texture} resolution={512} />
          <mesh position={[0, 150, 0]} scale={[1, 0.5, 1]}>
            <sphereGeometry args={[900, 64, 32]} />
            <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} depthWrite={true} fog={false} />
          </mesh>
        </>
      )}
    </>
  );
}
