import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShockWave } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../../../store/useGameStore';

export function ShockwaveEffect({ index }) {
  const shockRef = useRef();
  const shockwaveData = useGameStore(state => state.shockwaves[index]);
  const [life, setLife] = useState(1); // 1 = dead
  const [pos, setPos] = useState(new THREE.Vector3());
  const duration = 0.8; // seconds

  useEffect(() => {
    if (shockwaveData && shockwaveData.position) {
      setLife(0);
      setPos(new THREE.Vector3(...shockwaveData.position));
    }
  }, [shockwaveData]);

  useFrame((state, delta) => {
    if (life < 1) {
      setLife(prev => Math.min(1, prev + delta / duration));
    }
  });

  const size = life * 100.0;
  const opacity = 1.0 - life;

  return (
    <ShockWave
      position={[pos.x, pos.y, pos.z]}
      size={size}
      extent={0.1}
      amplitude={life >= 1 ? 0 : 0.5 * opacity}
    />
  );
}
