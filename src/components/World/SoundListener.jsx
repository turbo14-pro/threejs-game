import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { soundManager } from '../../utils/SoundManager';

/**
 * THE EARS OF THE GAME (SoundListener)
 * This component adds the 'AudioListener' to the camera.
 * Without this, we can't hear anything!
 */
export default function SoundListener() {
  const { camera } = useThree();

  useEffect(() => {
    // Connect the SoundManager to the main camera
    soundManager.init(camera);

    // Pre-load common sounds (even if files are missing, it sets up the slots)
    soundManager.load('footstep', '/audio/footstep.mp3');
    soundManager.load('jump', '/audio/jump.mp3');
    soundManager.load('land', '/audio/land.mp3');
    soundManager.load('splat', '/audio/splat.mp3');
  }, [camera]);

  return null;
}
