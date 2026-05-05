import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShockWave } from '@react-three/postprocessing';
import * as THREE from 'three';

export function ShockwaveEffect({ position }) {
  const shockRef = useRef();
  const [life, setLife] = useState(0); // 0 to 1
  const duration = 0.8; // seconds

  useFrame((state, delta) => {
    if (life < 1) {
      setLife(prev => Math.min(1, prev + delta / duration));
    }
  });

  // Automatically drive uniforms from life
  const size = life * 100.0; // Grows from 0 to 100
  const opacity = 1.0 - life; // Fades out

  if (life >= 1) return null;

  return (
    <ShockWave
      ref={shockRef}
      position={new THREE.Vector3(...position)}
      size={size}
      extent={0.1}
      amplitude={0.5 * opacity}
    />
  );
}
