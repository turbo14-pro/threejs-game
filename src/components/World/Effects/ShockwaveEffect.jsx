import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShockWave } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../../../store/useGameStore';
import { PLAYER_BASELINE, getActionIntensity } from '../../../config/playerConfig';

export function ShockwaveEffect({ index }) {
  const shockwaveData = useGameStore(state => state.shockwaves[index]);
  const [life, setLife] = useState(1); // 1 = dead
  const [intensity, setIntensity] = useState(1.0);
  const duration = PLAYER_BASELINE.shockwave.duration;
  const baseAmplitude = PLAYER_BASELINE.shockwave.baseAmplitude;
  const lastIdRef = useRef(null);

  useEffect(() => {
    // Only trigger on genuinely NEW shockwave data (by unique id), not on re-renders
    if (shockwaveData && shockwaveData.position && shockwaveData.id !== lastIdRef.current) {
      lastIdRef.current = shockwaveData.id;
      setLife(0);
      const currentPowerUp = useGameStore.getState().powerUp;
      const rawIntensity = shockwaveData.intensity 
        ?? getActionIntensity('slideImpact', currentPowerUp?.rarity || 'none');
      setIntensity(rawIntensity);
    }
  }, [shockwaveData]);

  useFrame((state, delta) => {
    if (life < 1) {
      const newLife = Math.min(1, life + delta / duration);
      setLife(newLife);
      // Clear the shockwave slot once animation is complete
      if (newLife >= 1 && lastIdRef.current) {
        const store = useGameStore.getState();
        const current = store.shockwaves[index];
        if (current && current.id === lastIdRef.current) {
          store.clearShockwaveSlot(index);
        }
        lastIdRef.current = null;
      }
    }
  });

  // Only render if we have actual shockwave data from an impact
  if (!shockwaveData?.position) return null;

  // Skip rendering if life is complete
  if (life >= 1) return null;

  const ripplePosition = [shockwaveData.position[0], shockwaveData.position[1], shockwaveData.position[2]];

  // Scale size and amplitude by intensity
  // Speed doubled so the ring expands faster across the screen
  const scaledSize = Math.max(0.01, life * 0.5 * intensity);
  const opacity = 1.0 - life;
  const amplitude = baseAmplitude * opacity * intensity * 1.5;

  return (
    <ShockWave
      position={ripplePosition}
      size={scaledSize}
      extent={0.8}
      amplitude={amplitude}
      speed={2.4}
    />
  );
}
