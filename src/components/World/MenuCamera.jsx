import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function MenuCamera() {
  const timeRef = useRef(0);

  useFrame(({ camera }, delta) => {
    timeRef.current += delta;
    const time = timeRef.current * 0.2;
    camera.position.x = Math.sin(time) * 40;
    camera.position.z = Math.cos(time) * 40;
    camera.position.y = 15;
    camera.lookAt(0, 0, 0);
  });

  return null;
}
