import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { soundManager } from '../../utils/SoundManager';

// P0-#2: single source of truth for bundled SFX. public/audio/*.ogg exists
// (verified), so these URLs are correct — do NOT point at src/audio-mp3.
const SFX = [
  ['running', '/audio/running.ogg'],
  ['walk', '/audio/walk.ogg'],
  ['metal-hit', '/audio/metal-hit.ogg'],
  ['metal-ground', '/audio/metal-ground.ogg'],
  ['hit', '/audio/hit.ogg'],
  ['powerup', '/audio/powerup.ogg'],
  ['teleport', '/audio/teleport.ogg'],
  ['launch', '/audio/launch.ogg'],
  ['land', '/audio/land.ogg'],
  ['slide', '/audio/slide.ogg'],
];

/**
 * THE EARS OF THE GAME (SoundListener)
 * This component adds the 'AudioListener' to the camera.
 * Without this, we can't hear anything!
 */
export default function SoundListener() {
  const { camera } = useThree();
  const cameraRef = useRef(null);

  useEffect(() => {
    // Connect the SoundManager to the main camera
    soundManager.init(camera);
    cameraRef.current = camera;

    // Pre-load common sounds (even if files are missing, it sets up the slots)
    for (const [name, url] of SFX) soundManager.load(name, url);

    // Resume AudioContext on first user gesture (browser policy).
    // P1-#6: mobile needs pointerdown/touchend (not just click/keydown), iOS
    // needs 'interrupted' handling, and tab-switch suspends need re-arming —
    // so these are NOT once:true and ensureRunning() also resumes per-play.
    const resume = () => {
      try { soundManager.ensureRunning(); } catch {}
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('touchend', resume);
    window.addEventListener('click', resume);
    window.addEventListener('keydown', resume);
    document.addEventListener('visibilitychange', resume);

    // P1-#7: cleanup — detach listener from the old camera, drop handlers,
    // stop loop sounds orphaned by remount so they can't corrupt the graph.
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchend', resume);
      window.removeEventListener('click', resume);
      window.removeEventListener('keydown', resume);
      document.removeEventListener('visibilitychange', resume);
      try {
        if (soundManager.listener && cameraRef.current) {
          const listener = soundManager.listener;
          const cam = cameraRef.current;
          // P0-#2: defer the detach. Effect cleanup can run inside a React
          // commit that interleaves with three's render traversal.
          const flush = () => {
            try { if (listener.parent === cam) cam.remove(listener); } catch {}
          };
          if (typeof queueMicrotask === 'function') queueMicrotask(flush);
          else setTimeout(flush, 0);
        }
      } catch {}
      try { soundManager.stopAll(); } catch {}
    };
  }, [camera]);

  return null;
}
