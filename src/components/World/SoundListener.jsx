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
    soundManager.load('running', '/audio/running.ogg');
    soundManager.load('walk', '/audio/walk.ogg');
    soundManager.load('metal-hit', '/audio/metal-hit.ogg');
    soundManager.load('metal-ground', '/audio/metal-ground.ogg');
    soundManager.load('hit', '/audio/hit.ogg');
    soundManager.load('powerup', '/audio/powerup.ogg');
    soundManager.load('teleport', '/audio/teleport.ogg');

    // Resume AudioContext on first user gesture (browser policy)
    const resume = () => { if (soundManager.listener?.context?.state === 'suspended') soundManager.listener.context.resume(); };
    window.addEventListener('click', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }, [camera]);

  return null;
}
