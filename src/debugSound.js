// Sound Debug Script — run in browser console or import temporarily
import { soundManager } from './src/utils/SoundManager';
import { debugLog } from './src/utils/debugLog.js';

export function debugSound() {
  debugLog('[DEBUG] listener:', !!soundManager.listener);
  debugLog('[DEBUG] listener context state:', soundManager.listener?.context?.state);
  debugLog('[DEBUG] sounds loaded:', Array.from(soundManager.sounds.keys()));
  debugLog('[DEBUG] running buffer?', soundManager.sounds.has('running'));
  debugLog('[DEBUG] instances count:', soundManager.instances.size);
  soundManager.instances.forEach((s, i) => {
    debugLog(`[DEBUG] instance ${i}: isPlaying=${s.isPlaying}, loop=${s.loop}, volume=${s.getVolume?.()}`);
  });
}
