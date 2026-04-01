import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function MenuCamera() {
  useFrame(({ camera, clock }) => {
    const time = clock.elapsedTime * 0.2;
    camera.position.x = Math.sin(time) * 40;
    camera.position.z = Math.cos(time) * 40;
    camera.position.y = 15;
    camera.lookAt(0, 0, 0);
  });

  return null;
}
