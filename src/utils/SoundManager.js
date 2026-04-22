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
  }

  // Initialize with a camera's listener
  init(camera) {
    if (this.listener) return;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    console.log('[Sound] AudioListener initialized on camera');
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
    sound.setVolume(volume);
    sound.setLoop(loop);
    sound.play();

    this.instances.add(sound);
    sound.onEnded = () => this.instances.delete(sound);
    return sound;
  }

  // Play a 3D sound attached to a specific object
  playPositional(name, parent, volume = 1.0, refDistance = 5, loop = false) {
    if (!this.listener || !this.sounds.has(name)) return null;

    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(this.sounds.get(name));
    sound.setVolume(volume);
    sound.setRefDistance(refDistance);
    sound.setLoop(loop);
    sound.play();

    parent.add(sound);
    this.instances.add(sound);
    sound.onEnded = () => {
      parent.remove(sound);
      this.instances.delete(sound);
    };
    return sound;
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
