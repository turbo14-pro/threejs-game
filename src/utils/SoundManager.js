import * as THREE from 'three';
import { debugLog, debugWarn } from './debugLog';

const AUDIO_VARIATION = 0.2;
const MAX_INSTANCES = 24;
// Cap for the lifecycle-debug bookkeeping map so long sessions cannot grow it
// without bound. Live (non-detached) nodes are never pruned.
const MAX_DEBUG_NODES = 200;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clampVolume(v, fallback = 0.5) {
  if (!Number.isFinite(v)) return fallback;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Reused scratch object — never allocate in per-frame audio paths.
const _scratchVec = new THREE.Vector3();

function nowMs() {
  try { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  catch { return Date.now(); }
}

// Deferred scene-graph detach queue. NEVER call parent.remove() from inside
// updateMatrixWorld / render traversal: three iterates the live children array
// with a cached length, so a mid-traversal splice makes children[i] undefined
// and crashes with "Cannot read properties of undefined (reading
// 'updateMatrixWorld')". Queue the detach and flush it in a microtask (or next
// useFrame), outside the traversal.
const _pendingDetach = [];
let _detachScheduled = false;
// Optional hook so the SoundManager can record lifecycle transitions that
// happen outside its methods (e.g. a stop triggered by the panner guard).
let _lifecycleHook = null;
function scheduleDetach(sound) {
  if (!sound) return;
  if (sound.__detachQueued) return;
  sound.__detachQueued = true;
  try { if (sound.isPlaying) sound.stop(); } catch {}
  try { sound.__smStopped = true; } catch {}
  try { if (_lifecycleHook) _lifecycleHook(sound, 'stopped'); } catch {}
  _pendingDetach.push(sound);
  if (!_detachScheduled) {
    _detachScheduled = true;
    const flush = () => {
      _detachScheduled = false;
      while (_pendingDetach.length) {
        const s = _pendingDetach.pop();
        try { if (s.parent) s.parent.remove(s); } catch {}
        try { if (s.isPlaying) s.stop(); } catch {}
        try { if (s.disconnect) s.disconnect(); } catch {}
        try { if (_lifecycleHook) _lifecycleHook(s, 'detached'); } catch {}
        s.__detachQueued = false;
      }
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(flush);
    else setTimeout(flush, 0);
  }
}

// three's Audio.prototype.onEnded resets `isPlaying` and `_progress`. Because
// we override `onEnded` per instance, we MUST chain to the base implementation:
// three binds `source.onended = this.onEnded.bind(this)` at play() time, so the
// prototype method is bypassed and `isPlaying` would stay true forever.
const _baseOnEnded = THREE.Audio.prototype.onEnded;
function runBaseOnEnded(sound) {
  try { _baseOnEnded.call(sound); } catch {}
}

function matrixWorldPositionFinite(obj) {
  try {
    if (!obj || !obj.matrixWorld) return false;
    _scratchVec.setFromMatrixPosition(obj.matrixWorld);
    return Number.isFinite(_scratchVec.x) && Number.isFinite(_scratchVec.y) && Number.isFinite(_scratchVec.z);
  } catch {
    return false;
  }
}
function applyRandomVariation(sound, buffer, loop) {
  try {
    const pitchFactor = 1 + (Math.random() * 2 - 1) * AUDIO_VARIATION;
    const detune = 1200 * Math.log2(Math.max(0.0001, pitchFactor));
    if (Number.isFinite(detune)) { try { sound.setDetune(detune); } catch {} }

    // Audio.duration caps total playback, so leave looping sounds unbounded.
    if (!loop && buffer && Number.isFinite(buffer.duration) && buffer.duration > 0) {
      const durationFactor = 1 + (Math.random() * 2 - 1) * AUDIO_VARIATION;
      const d = buffer.duration * durationFactor;
      if (Number.isFinite(d) && d > 0) { try { sound.duration = d; } catch {} }
    }
  } catch { /* never let variation break playback */ }
}

class SoundManager {
  // Manages loading and playing spatial audio using Three.js PositionalAudio.
  // Uses exponential distance model with maxDistance=50 for realistic falloff.
  // All positional sounds attach to visualRef (not rigidRef) for stable panning.
  // Volume = speed/15 for slide hits, relativeImpactSpeed/15 for other hits, capped at 1.
  // 300ms cooldown prevents rapid-fire triggering on non-slide collisions.
  // Dynamic labels: "hard" (>0.5 vol), "medium" (>0.2 vol), "gentle" (<=0.2 vol).

  constructor() {
    this.listener = null;
    this.audioLoader = new THREE.AudioLoader();
    this.sounds = new Map(); // Buffer Cache
    this.instances = new Set(); // Active sounds
    this.masterGain = null; // Master SFX gain (not used for connect; volume multiplier instead)
    this.masterVolume = 1.0; // Global SFX multiplier (0-1)
    // AUDIO LIFECYCLE DEBUG: per-node bookkeeping for post-crash inspection.
    this._debugMeta = new Map();
    this._debugCounter = 0;
    // Route deferred-detach lifecycle events into the debug metadata so a
    // snapshot reflects real stop/detach state instead of guesses.
    _lifecycleHook = (sound, event) => {
      try {
        if (event === 'stopped') this._debugMarkStopped(sound);
        else if (event === 'detached') {
          // A detached node is no longer live: drop it from `instances` so the
          // set cannot grow unboundedly. Without this, sounds stopped by the
          // NaN guard / eviction path stayed tracked forever and the
          // MAX_INSTANCES cap started force-killing unrelated live sounds.
          try { this.instances.delete(sound); } catch {}
          this._debugUnregister(sound, 'detached');
        }
      } catch {}
    };
  }

  // Initialize with a camera's listener.
  // NOTE: never resets masterVolume — init() can re-fire when the camera object
  // identity changes, and wiping a user-set volume there is bug P1-#5.
  init(camera) {
    try {
      if (this.listener) {
        // Re-parent surviving listener if the camera instance changed.
        // P0-#2: the old code called this.listener.parent.remove(this.listener)
        // inline — init() can run from a useFrame, so that splice could land
        // mid-traversal. Defer both halves of the re-parent.
        try {
          if (camera && camera !== this.listener.parent && typeof camera.add === 'function') {
            const oldParent = this.listener.parent;
            const listener = this.listener;
            const flush = () => {
              try { if (oldParent) oldParent.remove(listener); } catch {}
              try { if (listener.parent !== camera) camera.add(listener); } catch {}
            };
            if (typeof queueMicrotask === 'function') queueMicrotask(flush);
            else setTimeout(flush, 0);
          }
        } catch {}
        return;
      }
      if (!camera || typeof camera.add !== 'function') return;
      this.listener = new THREE.AudioListener();
      camera.add(this.listener);
      // Resume AudioContext after user interaction (browser policy)
      try {
        if (this.listener.context && this.listener.context.state === 'suspended') {
          this.listener.context.resume().catch(() => {});
        }
      } catch {}
      debugLog('[Sound] AudioListener initialized on camera');
      this.masterGain = null; // Not used for connect (THREE.Audio.connect expects Audio nodes)
      // masterVolume keeps its constructor default (1.0) — never reset here.
    } catch (e) {
      debugWarn('[Sound] init failed', e);
    }
  }

  // Try to resume a suspended AudioContext (autoplay policy). Returns true when
  // the context is running and playback may proceed. Fixes P1-#6: mobile
  // gestures + tab-switch suspends previously left play() calls throwing.
  ensureRunning() {
    try {
      const ctx = this.listener?.context;
      if (!ctx) return false;
      if (ctx.state === 'running') return true;
      if (ctx.state === 'suspended') {
        try { ctx.resume().catch(() => {}); } catch {}
        return false; // skip this play; the next user-gesture frame will succeed
      }
      if (ctx.state === 'interrupted') {
        try { ctx.resume().catch(() => {}); } catch {}
        return false;
      }
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  _trackInstance(sound) {
    // P1-#8: cap live nodes. Looping sounds never fire onEnded, so without a
    // cap the Set (and the AudioGraph) grows forever on remount-heavy flows.
    try {
      if (this.instances.size >= MAX_INSTANCES) {
        const oldest = this.instances.values().next().value;
        if (oldest && oldest !== sound) {
          try { if (oldest.isPlaying) oldest.stop(); } catch {}
          // P0-#2: never remove() inline — this runs from playPositional(),
          // which can be called from inside useFrame (mid-traversal).
          scheduleDetach(oldest);
          this.instances.delete(oldest);
        }
      }
      this.instances.add(sound);
    } catch {}
    this._debugRegister(sound);
  }

  _untrackInstance(sound, reason = 'ended') {
    try { this.instances.delete(sound); } catch {}
    // NOTE: this only stops TRACKING. The node is not detached yet — the
    // deferred flush in scheduleDetach() reports 'detached' later. Marking
    // `detached` here would make the snapshot lie about scene-graph state.
    this._debugMarkStopped(sound);
    try {
      const meta = this._debugMeta.get(sound);
      if (meta) meta.endReason = reason;
    } catch {}
  }

  // --- AUDIO LIFECYCLE DEBUG -------------------------------------------
  // Every sound we create is registered here so a crash can be inspected
  // AFTER the fact: "which nodes were alive, which were never detached?".
  // A node that stays registered long after it stopped playing is the
  // classic symptom of a broken audio lifecycle (orphaned PositionalAudio
  // still parented to the player group).
  _debugRegister(sound) {
    try {
      if (!sound) return;
      this._debugMeta.set(sound, {
        id: ++this._debugCounter,
        name: sound.__smName || 'unknown',
        // NOTE: three r183 has NO `isPositionalAudio` flag. Positional audio is
        // detected by the presence of the `panner` node (PositionalAudio only).
        positional: !!sound.panner,
        createdAt: nowMs(),
        parent: sound.parent ? (sound.parent.uuid || 'parent') : null,
        parentName: sound.parent ? (sound.parent.name || sound.parent.type || 'unnamed') : null,
        detached: false,
        stopped: false,
      });
      // RETENTION: keep the debug map bounded. Detached nodes are dropped
      // oldest-first; live nodes are always kept so the leak signature
      // (a node created but never detached) stays visible.
      if (this._debugMeta.size > MAX_DEBUG_NODES) {
        for (const [key, m] of this._debugMeta) {
          if (this._debugMeta.size <= MAX_DEBUG_NODES) break;
          if (m.detached) this._debugMeta.delete(key);
        }
      }
    } catch {}
  }

  _debugUnregister(sound, reason = 'ended') {
    try {
      const meta = this._debugMeta.get(sound);
      if (meta) {
        meta.detached = true;
        meta.stopped = true;
        meta.endReason = reason;
        meta.detachedAt = nowMs();
      }
    } catch {}
  }

  _debugMarkStopped(sound) {
    try {
      const meta = this._debugMeta.get(sound);
      if (meta) meta.stopped = true;
    } catch {}
  }

  /**
   * Snapshot of the audio lifecycle. Safe to call from an error handler.
   * Returns the live instance count plus per-node bookkeeping so we can see
   * nodes that were created but never detached (the leak signature).
   */
  getDebugSnapshot() {
    const nodes = [];
    try {
      for (const [sound, meta] of this._debugMeta) {
        nodes.push({
          ...meta,
          isPlaying: !!sound.isPlaying,
          hasParent: !!sound.parent,
          stillInScene: !!sound.parent,
        });
      }
    } catch {}
    return {
      at: new Date().toISOString(),
      liveInstances: this.instances ? this.instances.size : 0,
      trackedNodes: nodes.length,
      // Leak signature: a node that is still parented to the scene but is no
      // longer tracked/playing is an orphaned audio node.
      orphanedNodes: nodes.filter(n => n.hasParent && !n.isPlaying).length,
      nodes,
    };
  }

  // Load a sound into memory
  async load(name, url) {
    if (this.sounds.has(name)) return;
    
    return new Promise((resolve) => {
      this.audioLoader.load(url, (buffer) => {
        this.sounds.set(name, buffer);
        debugLog(`[Sound] Loaded: ${name}`);
        resolve(buffer);
      }, undefined, (err) => {
        // Silently handle encoding/loading errors to avoid console spam
        debugWarn(`[Sound] Could not load ${name} from ${url}. (File might be missing or invalid)`);
        resolve(null);
      });
    });
  }

  // Play a simple global sound (UI, Menu etc)
  playGlobal(name, volume = 0.5, loop = false) {
    try {
      if (!this.listener || !this.sounds.has(name)) return null;
      const buffer = this.sounds.get(name);
      if (!buffer) return null;
      if (!this.ensureRunning()) return null;
      const safeVolume = clampVolume(volume, 0.5) * clampVolume(this.masterVolume, 1.0);
      if (!Number.isFinite(safeVolume)) return null;
      const sound = new THREE.Audio(this.listener);
      sound.__smName = name;
      sound.setBuffer(buffer);
      try { sound.setVolume(safeVolume); } catch { return null; }
      sound.setLoop(!!loop);
      applyRandomVariation(sound, buffer, !!loop);
      sound.onEnded = () => {
        runBaseOnEnded(sound);
        this._untrackInstance(sound);
        scheduleDetach(sound);
      };
      this._trackInstance(sound);
      try { sound.play(); } catch { this._untrackInstance(sound); scheduleDetach(sound); return null; }
      return sound;
    } catch { return null; }
  }

  // Play a 3D sound attached to a specific object.
  // ROOT CAUSE of "Cannot read properties of undefined (reading
  // 'updateMatrixWorld')" on step: the old code called parent.remove(sound)
  // from INSIDE sound.updateMatrixWorld (reached via the NaN-guard detach) and
  // from PlayerController stop paths that run mid-frame. three iterates the
  // live children array with a cached length, so a mid-traversal splice makes
  // children[i] undefined and every later sibling crashes. Fix: (a) NEVER
  // remove() during traversal — scheduleDetach() flushes in a microtask; (b)
  // skip the panner write when the world position is non-finite instead of
  // detaching at all; (c) zero per-frame allocation via shared scratch.
  playPositional(name, parent, volume = 1.0, refDistance = 5, rolloffFactor = 1.0, maxDistance = 50, loop = false) {
    try {
      if (!this.listener || !this.sounds.has(name)) return null;
      const buffer = this.sounds.get(name);
      if (!buffer) return null;
      if (!this.ensureRunning()) return null;
      if (!parent || typeof parent.add !== 'function') return null;
      if (!matrixWorldPositionFinite(parent)) return null;
      const safeVolume = clampVolume(volume, 1.0) * clampVolume(this.masterVolume, 1.0);
      const sound = new THREE.PositionalAudio(this.listener);
      sound.__smName = name;

      sound.setBuffer(buffer);
      try {
        sound.setVolume(safeVolume);
        sound.setRefDistance(finiteOr(refDistance, 5) > 0 ? finiteOr(refDistance, 5) : 5);
        sound.setRolloffFactor(finiteOr(rolloffFactor, 1.0));
        sound.setMaxDistance(finiteOr(maxDistance, 50) > 0 ? finiteOr(maxDistance, 50) : 50);
      } catch { return null; }
      sound.setDistanceModel('exponential');
      sound.setLoop(!!loop);
      applyRandomVariation(sound, buffer, !!loop);
      // Guard the per-frame panner write WITHOUT touching the scene graph:
      // if the parent went NaN (corrupt Rapier body), skip the three panner
      // update for this frame (no linearRamp call => no throw) but still run
      // the base Object3D update so children stay consistent. Detach is
      // deferred out-of-traversal via scheduleDetach().
      try {
        const proto = Object.getPrototypeOf(sound);
        if (!proto.__smGuarded) {
          proto.__smGuarded = true;
          const baseUpdate = proto.updateMatrixWorld;
          proto.updateMatrixWorld = function (force) {
            try {
              if (this && this.panner && this.matrixWorld) {
                _scratchVec.setFromMatrixPosition(this.matrixWorld);
                if (!Number.isFinite(_scratchVec.x) || !Number.isFinite(_scratchVec.y) || !Number.isFinite(_scratchVec.z)) {
                  // World transform corrupt: freeze panner (skip base audio
                  // update that would linearRamp(NaN)) and queue a detach.
                  try { if (this.isPlaying) this.stop(); } catch {}
                  scheduleDetach(this);
                  return;
                }
              }
            } catch {}
            return baseUpdate.call(this, force);
          };
        }
      } catch {}
      parent.add(sound);
      // AUDIO LIFECYCLE FIX: three binds `source.onended = this.onEnded.bind(this)`
      // INSIDE play(), so `onEnded` MUST be assigned BEFORE play() or the
      // cleanup callback is never invoked and the node leaks.
      sound.onEnded = () => {
        // Chain to three's base onEnded FIRST so `isPlaying`/`_progress` reset.
        runBaseOnEnded(sound);
        this._untrackInstance(sound);
        scheduleDetach(sound);
      };
      this._trackInstance(sound);
      try { sound.play(); } catch { this._untrackInstance(sound); scheduleDetach(sound); return null; }
      return sound;
    } catch { return null; }
  }

  setMasterVolume(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    this.masterVolume = Math.max(0, Math.min(1, v));
  }

  // Release a sound that the caller owns (e.g. a movement loop the player
  // controller stops itself). Stops playback, untracks it from `instances`
  // and defers the scene-graph detach so we never splice a parent's children
  // array mid-traversal. Without this, a stopped loop stayed in `instances`
  // forever — the set grew with every walk/run cycle and the MAX_INSTANCES
  // cap started force-killing unrelated live sounds.
  release(sound) {
    if (!sound) return;
    try { if (sound.isPlaying) sound.stop(); } catch {}
    this._untrackInstance(sound, 'released');
    scheduleDetach(sound);
  }

  stopAll() {
    // P0-#2: stop immediately (audio must silence now) but DEFER the scene-graph
    // detach so we never splice a parent's children array mid-traversal.
    try {
      this.instances.forEach(s => {
        try { if (s.isPlaying) s.stop(); } catch {}
        scheduleDetach(s);
      });
    } catch {}
    this.instances.clear();
  }
}

// Exported for unit tests (each test needs its own instance so the shared
// singleton's state cannot leak between cases).
export { SoundManager };

export const soundManager = new SoundManager();

// --- AUDIO LIFECYCLE DEBUG EXPOSURE ------------------------------------
// Console handles for the bisect. Available in the browser console without
// any rebuild:
//   soundManager.getDebugSnapshot()   -> lifecycle snapshot (live nodes)
//   soundManager.dumpLifecycle()      -> same, but pretty-printed
//   audioDebug.list()                 -> which code paths are enabled
if (typeof window !== 'undefined') {
  window.soundManager = soundManager;
  window.dumpAudioLifecycle = () => {
    const snap = soundManager.getDebugSnapshot();
    console.group('[audioDebug] lifecycle snapshot');
    console.log('live instances:', snap.liveInstances, '| tracked nodes:', snap.trackedNodes);
    console.table(snap.nodes);
    console.groupEnd();
    return snap;
  };
}

