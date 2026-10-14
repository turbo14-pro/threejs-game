import * as THREE from 'three';

/**
 * THE SOUND BRAIN (SoundManager)
 * Utility to manage loading and playing spatial audio.
 */
class SoundManager {
  constructor() {
    this.listener = null;
    this.audioLoader = new THREE.AudioLoader();
    this.sounds = new Map(); // Buffer Cache
    this.instances = new Set(); // Active sounds
    this.masterGain = null; // Master SFX gain (not used for connect; volume multiplier instead)
    this.masterVolume = 1.0; // Global SFX multiplier (0-1)
  }

  // Initialize with a camera's listener
  init(camera) {
    if (this.listener) return;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    // Resume AudioContext after user interaction (browser policy)
    if (this.listener.context && this.listener.context.state === 'suspended') {
      this.listener.context.resume();
    }
    console.log('[Sound] AudioListener initialized on camera');
    // Master gain node for global SFX volume
    this.masterGain = null; // Not used for connect (THREE.Audio.connect expects Audio nodes)
    this.masterVolume = 1.0;
  }

  // Load a sound into memory
  async load(name, url) {
    if (this.sounds.has(name)) return;
    
    return new Promise((resolve) => {
      this.audioLoader.load(url, (buffer) => {
        this.sounds.set(name, buffer);
        console.log(`[Sound] Loaded: ${name}`);
        resolve(buffer);
      }, undefined, (err) => {
        // Silently handle encoding/loading errors to avoid console spam
        console.warn(`[Sound] Could not load ${name} from ${url}. (File might be missing or invalid)`);
        resolve(null);
      });
    });
  }

  // Play a simple global sound (UI, Menu etc)
  playGlobal(name, volume = 0.5, loop = false) {
    if (!this.listener || !this.sounds.has(name)) return null;

    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(this.sounds.get(name));
    sound.setVolume(volume * (this.masterVolume || 1.0));
    sound.setLoop(loop);
    sound.play();

    this.instances.add(sound);
    sound.onEnded = () => this.instances.delete(sound);
    return sound;
  }

  // Play a 3D sound attached to a specific object
  playPositional(name, parent, volume = 50, refDistance = 10, rolloffFactor = 1.0, loop = false) {
    if (!this.listener || !this.sounds.has(name)) return null;

    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(this.sounds.get(name));
    sound.setVolume(volume * (this.masterVolume || 1.0));
    sound.setRefDistance(refDistance);
    sound.setRolloffFactor(rolloffFactor);
    sound.setDistanceModel('inverse');
    sound.setLoop(loop);

    // Short reverb via delay + feedback loop (room effect)
    const ctx = this.listener.context;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.08;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    const panner = sound.getOutput ? sound.getOutput() : sound;
    panner.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    // Distant echo for loud sounds (volume >= 80 on 1-100 scale)
    if (volume >= 80) {
      const echo = new THREE.PositionalAudio(this.listener);
      echo.setBuffer(this.sounds.get(name));
      echo.setVolume(volume * 0.15 * (this.masterVolume || 1.0));
      echo.setRefDistance(refDistance * 3);
      echo.setRolloffFactor(rolloffFactor * 2);
      echo.setDistanceModel('inverse');
      echo.setLoop(loop);
      parent.add(echo);
      this.instances.add(echo);
      echo.onEnded = () => { parent.remove(echo); this.instances.delete(echo); };
      setTimeout(() => echo.play(), 120);
    }

    sound.play();

    parent.add(sound);
    this.instances.add(sound);
    sound.onEnded = () => {
      parent.remove(sound);
      this.instances.delete(sound);
    };
    return sound;
  }

  // Set master SFX volume (0.0 - 1.0) — applied as multiplier to all sounds
  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
  }

  // Stop all sounds (Clean up)
  stopAll() {
    this.instances.forEach(s => {
      if (s.isPlaying) s.stop();
    });
    this.instances.clear();
  }
}

export const soundManager = new SoundManager();
