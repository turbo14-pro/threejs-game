import * as THREE from 'three';
import { debugLog, debugWarn } from './debugLog';

const AUDIO_VARIATION = 0.2;

function applyRandomVariation(sound, buffer, loop) {
  const pitchFactor = 1 + (Math.random() * 2 - 1) * AUDIO_VARIATION;
  sound.setDetune(1200 * Math.log2(pitchFactor));

  // Audio.duration caps total playback, so leave looping sounds unbounded.
  if (!loop) {
    const durationFactor = 1 + (Math.random() * 2 - 1) * AUDIO_VARIATION;
    sound.duration = buffer.duration * durationFactor;
  }
}

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
    debugLog('[Sound] AudioListener initialized on camera');
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
    if (!this.listener || !this.sounds.has(name)) return null;

    const buffer = this.sounds.get(name);
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setVolume(volume * (this.masterVolume || 1.0));
    sound.setLoop(loop);
    applyRandomVariation(sound, buffer, loop);
    sound.play();

    this.instances.add(sound);
    sound.onEnded = () => this.instances.delete(sound);
    return sound;
  }

  // Play a 3D sound attached to a specific object
  playPositional(name, parent, volume = 50, refDistance = 10, rolloffFactor = 1.0, loop = false) {
    if (!this.listener || !this.sounds.has(name)) return null;

    const buffer = this.sounds.get(name);
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(buffer);
    sound.setVolume(volume * (this.masterVolume || 1.0));
    sound.setRefDistance(refDistance);
    sound.setRolloffFactor(rolloffFactor);
    sound.setDistanceModel('linear');
    sound.setLoop(loop);
    applyRandomVariation(sound, buffer, loop);

    sound.play();

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
