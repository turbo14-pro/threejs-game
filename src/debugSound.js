// Sound Debug Script — run in browser console or import temporarily
import { soundManager } from './src/utils/SoundManager';

export function debugSound() {
  console.log('[DEBUG] listener:', !!soundManager.listener);
  console.log('[DEBUG] listener context state:', soundManager.listener?.context?.state);
  console.log('[DEBUG] sounds loaded:', Array.from(soundManager.sounds.keys()));
  console.log('[DEBUG] running buffer?', soundManager.sounds.has('running'));
  console.log('[DEBUG] instances count:', soundManager.instances.size);
  soundManager.instances.forEach((s, i) => {
    console.log(`[DEBUG] instance ${i}: isPlaying=${s.isPlaying}, loop=${s.loop}, volume=${s.getVolume?.()}`);
  });
}
