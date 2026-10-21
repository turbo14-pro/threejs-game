/**
 * AUDIO LIFECYCLE DEBUG FLAGS
 * ----------------------------
 * Bisect harness for the "audio lifecycle error" that fires whenever the
 * player moves (run / walk / slide / dash) but NOT when the player only jumps.
 *
 * WHY A FLAG AND NOT A PLAIN COMMENT
 * The crash happens on the *first movement frame* after a movement sound node
 * is attached to the scene graph. To prove or disprove a single sound as the
 * culprit we need to be able to switch that sound's code path off WITHOUT
 * touching the source again (otherwise each experiment is a new diff and the
 * bisect stops being reproducible).
 *
 * So: the uncommitted slide-sound additions are *commented out* here and
 * guarded by `audioDebugFlags.slideSound`. Flip the flag from the browser
 * console and reload — no rebuild, no new diff:
 *
 *   audioDebug.set('slideSound', false);   // disable
 *   audioDebug.set('slideSound', true);    // re-enable
 *   audioDebug.list();                      // show all flags
 *
 * Flags persist in localStorage so a reload keeps the same experiment setup.
 */

const STORAGE_KEY = 'food-frenzy-audio-debug-flags';

/**
 * Every flag defaults to TRUE (code enabled). Turning a flag OFF disables the
 * corresponding audio code path so we can prove whether that path is the
 * source of the crash.
 */
export const AUDIO_DEBUG_DEFAULTS = {
  // Uncommitted slide-sound additions (playPositional('slide') + fade-out).
  // DISABLED BY DEFAULT => the slide sound is out of the audio lifecycle while
  // we bisect. Set to true to re-enable and confirm whether it is the culprit.
  slideSound: false,
  // Movement loops (walk / running) — the other movement-tied audio path.
  movementLoops: false,
  // Positional one-shots (jump / land / hit / teleport / launch).
  oneShots: true,
  // The global (non-positional) fallback used when playPositional() fails.
  globalFallback: true,
};

const FLAGS = { ...AUDIO_DEBUG_DEFAULTS };

function readStored() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const key of Object.keys(AUDIO_DEBUG_DEFAULTS)) {
      if (typeof parsed[key] === 'boolean') FLAGS[key] = parsed[key];
    }
  } catch { /* never let debug state break the game */ }
}

function persist() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(FLAGS));
  } catch { /* ignore */ }
}

readStored();

/** Read a flag (unknown keys fall back to `true` so code stays enabled). */
export function audioFlag(name) {
  if (!(name in FLAGS)) return true;
  return FLAGS[name];
}

/** Set a flag and persist it. Returns the new value. */
export function setAudioFlag(name, value) {
  if (!(name in FLAGS)) {
    console.warn(`[audioDebug] unknown flag "${name}"`);
    return true;
  }
  FLAGS[name] = Boolean(value);
  persist();
  console.log(`[audioDebug] ${name} = ${FLAGS[name]}`);
  return FLAGS[name];
}

/** All flags with their current values. */
export function listAudioFlags() {
  return { ...FLAGS };
}

/** Reset every flag back to its default (all enabled). */
export function resetAudioFlags() {
  Object.assign(FLAGS, AUDIO_DEBUG_DEFAULTS);
  persist();
  console.log('[audioDebug] flags reset', { ...FLAGS });
  return { ...FLAGS };
}

// Expose on window for console-driven bisecting without a rebuild.
if (typeof window !== 'undefined') {
  window.audioDebug = {
    set: setAudioFlag,
    get: audioFlag,
    list: listAudioFlags,
    reset: resetAudioFlags,
    defaults: { ...AUDIO_DEBUG_DEFAULTS },
  };
}
