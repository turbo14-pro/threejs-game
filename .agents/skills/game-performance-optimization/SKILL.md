---
name: game-performance-optimization
description: Guide for implementing adaptive quality systems and FPS monitoring for mobile browser games. Use this when optimizing performance, implementing quality scaling, monitoring frame rates, or managing battery/thermal constraints.
---

# Game Performance Optimization for Mobile Browser

This skill provides guidance for implementing adaptive quality systems, FPS monitoring, battery optimization, and thermal management for mobile-first browser games.

## Performance Targets

| Metric | Target | Minimum |
|--------|--------|---------|
| Frame Rate (Flagship) | 60 fps | 55 fps |
| Frame Rate (Mid-Range) | 45 fps | 30 fps |
| Frame Rate (Budget) | 30 fps | 25 fps |
| Initial Load Time (4G) | 2 sec | 3 sec |
| Time to Interactive | 3 sec | 5 sec |
| Battery Drain Rate | 8%/hr | 10%/hr |
| Thermal Throttle Delay | 10 min | 5 min |
| Memory Footprint | 80 MB | 100 MB |

## Device Tier Classification

```typescript
type DeviceTier = 'high' | 'medium' | 'low';

interface DeviceProfile {
  tier: DeviceTier;
  targetFPS: number;
  shadowResolution: number;
  particleDensity: number;
  textureQuality: 'high' | 'medium' | 'low';
  postProcessing: boolean;
  antialiasing: boolean;
}

const DEVICE_PROFILES: Record<DeviceTier, DeviceProfile> = {
  high: {
    tier: 'high',
    targetFPS: 60,
    shadowResolution: 1024,
    particleDensity: 1.0,
    textureQuality: 'high',
    postProcessing: true,
    antialiasing: true
  },
  medium: {
    tier: 'medium',
    targetFPS: 45,
    shadowResolution: 512,
    particleDensity: 0.5,
    textureQuality: 'medium',
    postProcessing: false,
    antialiasing: true
  },
  low: {
    tier: 'low',
    targetFPS: 30,
    shadowResolution: 0, // No shadows
    particleDensity: 0.25,
    textureQuality: 'low',
    postProcessing: false,
    antialiasing: false
  }
};
```

## Device Tier Detection

```typescript
function detectDeviceTier(): DeviceTier {
  const gpu = (navigator as any).gpu;
  const memory = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const isLowEnd = /Android.*[45]\./i.test(navigator.userAgent);
  
  // WebGPU + good specs = high tier
  if (gpu && memory >= 8 && cores >= 6 && !isLowEnd) {
    return 'high';
  }
  
  // Mid-range check
  if (memory >= 4 && cores >= 4) {
    return 'medium';
  }
  
  return 'low';
}

function getDeviceProfile(): DeviceProfile {
  const tier = detectDeviceTier();
  return DEVICE_PROFILES[tier];
}
```

## Real-Time FPS Monitoring

```typescript
class PerformanceManager {
  private frameTimes: number[] = [];
  private currentTier: DeviceTier;
  private readonly SAMPLE_SIZE = 180; // 3 seconds at 60fps
  private readonly UPGRADE_THRESHOLD = 55;
  private readonly DOWNGRADE_THRESHOLD = 30;
  private profile: DeviceProfile;
  
  constructor() {
    const initialTier = detectDeviceTier();
    this.currentTier = initialTier;
    this.profile = DEVICE_PROFILES[initialTier];
  }

  recordFrame(deltaTime: number) {
    this.frameTimes.push(deltaTime);
    
    if (this.frameTimes.length > this.SAMPLE_SIZE) {
      this.evaluatePerformance();
      this.frameTimes = [];
    }
  }

  private evaluatePerformance() {
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
    const avgFps = 1000 / avgFrameTime;
    
    console.log(`Average FPS: ${avgFps.toFixed(1)}`);
    
    if (avgFps < this.DOWNGRADE_THRESHOLD && this.currentTier !== 'low') {
      this.downgradeTier();
    } else if (avgFps > this.UPGRADE_THRESHOLD && this.currentTier !== 'high') {
      this.upgradeTier();
    }
  }

  private downgradeTier() {
    const tiers: DeviceTier[] = ['high', 'medium', 'low'];
    const currentIndex = tiers.indexOf(this.currentTier);
    if (currentIndex < tiers.length - 1) {
      this.currentTier = tiers[currentIndex + 1];
      this.profile = DEVICE_PROFILES[this.currentTier];
      this.applyQualitySettings();
      console.log(`Downgraded to ${this.currentTier} tier`);
    }
  }

  private upgradeTier() {
    const tiers: DeviceTier[] = ['high', 'medium', 'low'];
    const currentIndex = tiers.indexOf(this.currentTier);
    if (currentIndex > 0) {
      this.currentTier = tiers[currentIndex - 1];
      this.profile = DEVICE_PROFILES[this.currentTier];
      this.applyQualitySettings();
      console.log(`Upgraded to ${this.currentTier} tier`);
    }
  }

  private applyQualitySettings() {
    // Emit event for game systems to respond
    window.dispatchEvent(new CustomEvent('qualityChange', {
      detail: this.profile
    }));
  }

  getCurrentProfile(): DeviceProfile {
    return this.profile;
  }

  getAverageFPS(): number {
    if (this.frameTimes.length === 0) return 60;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
    return 1000 / avgFrameTime;
  }
}
```

## Battery Optimization

```typescript
class BatteryManager {
  private battery: any = null;
  private lowPowerMode = false;

  async initialize() {
    if ('getBattery' in navigator) {
      try {
        this.battery = await (navigator as any).getBattery();
        this.setupListeners();
        this.checkBatteryLevel();
      } catch (e) {
        console.warn('Battery API not available');
      }
    }
  }

  private setupListeners() {
    if (!this.battery) return;
    
    this.battery.addEventListener('levelchange', () => {
      this.checkBatteryLevel();
    });
    
    this.battery.addEventListener('chargingchange', () => {
      this.checkBatteryLevel();
    });
  }

  private checkBatteryLevel() {
    if (!this.battery) return;
    
    const level = this.battery.level;
    const charging = this.battery.charging;
    
    if (!charging && level < 0.20) {
      this.enableLowPowerMode();
    } else if (charging || level > 0.30) {
      this.disableLowPowerMode();
    }
  }

  private enableLowPowerMode() {
    if (this.lowPowerMode) return;
    
    this.lowPowerMode = true;
    console.log('Enabling low power mode');
    
    window.dispatchEvent(new CustomEvent('lowPowerMode', {
      detail: { enabled: true }
    }));
  }

  private disableLowPowerMode() {
    if (!this.lowPowerMode) return;
    
    this.lowPowerMode = false;
    console.log('Disabling low power mode');
    
    window.dispatchEvent(new CustomEvent('lowPowerMode', {
      detail: { enabled: false }
    }));
  }

  isLowPowerMode(): boolean {
    return this.lowPowerMode;
  }
}
```

## Low Power Mode Adjustments

```typescript
function applyLowPowerSettings(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  // Reduce target FPS to 30
  // This can be done by throttling the animation loop
  
  // Disable shadows
  renderer.shadowMap.enabled = false;
  
  // Disable post-processing
  // composer.passes = composer.passes.filter(p => p.name === 'renderPass');
  
  // Reduce physics substeps
  // physicsWorker.postMessage({ type: 'SET_SUBSTEPS', data: 1 });
  
  // Lower particle counts
  scene.traverse((obj) => {
    if (obj.name.includes('particle')) {
      obj.visible = false;
    }
  });
  
  // Reduce draw distance
  // camera.far = 50;
  // camera.updateProjectionMatrix();
}
```

## Thermal Throttling Prevention

```typescript
class ThermalManager {
  private startTime: number;
  private performanceDrops: number[] = [];
  
  constructor() {
    this.startTime = Date.now();
  }

  recordPerformanceDrop(fps: number, expectedFps: number) {
    const dropPercentage = 1 - (fps / expectedFps);
    if (dropPercentage > 0.2) { // 20% drop
      this.performanceDrops.push(Date.now());
      
      // Keep only last 5 minutes of data
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      this.performanceDrops = this.performanceDrops.filter(t => t > fiveMinutesAgo);
      
      // If 3+ drops in 5 minutes, likely thermal throttling
      if (this.performanceDrops.length >= 3) {
        this.handleThermalThrottling();
      }
    }
  }

  private handleThermalThrottling() {
    console.warn('Thermal throttling detected');
    
    window.dispatchEvent(new CustomEvent('thermalThrottling', {
      detail: {
        sessionDuration: Date.now() - this.startTime,
        recommendation: 'reduce_quality'
      }
    }));
  }

  getSessionDuration(): number {
    return Date.now() - this.startTime;
  }
}
```

## Memory Management

```typescript
class MemoryManager {
  private objectPool: Map<string, any[]> = new Map();
  private disposables: Set<{ dispose: () => void }> = new Set();

  // Object pooling for frequently created/destroyed objects
  acquire<T>(type: string, factory: () => T): T {
    const pool = this.objectPool.get(type) || [];
    if (pool.length > 0) {
      return pool.pop() as T;
    }
    return factory();
  }

  release(type: string, object: any) {
    const pool = this.objectPool.get(type) || [];
    pool.push(object);
    this.objectPool.set(type, pool);
  }

  // Track disposable resources
  track(disposable: { dispose: () => void }) {
    this.disposables.add(disposable);
  }

  // Periodic cleanup
  cleanup() {
    // Clear object pools that are too large
    for (const [type, pool] of this.objectPool) {
      if (pool.length > 100) {
        // Dispose excess objects
        while (pool.length > 50) {
          const obj = pool.pop();
          if (obj?.dispose) obj.dispose();
        }
      }
    }
    
    // Force garbage collection hint (no guarantee)
    if ('gc' in window) {
      (window as any).gc();
    }
  }

  // Clean up on game end
  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.clear();
    this.objectPool.clear();
  }
}
```

## Performance HUD (Debug Mode)

```typescript
class PerformanceHUD {
  private container: HTMLDivElement;
  private visible = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 4px;
      z-index: 9999;
      display: none;
    `;
    document.body.appendChild(this.container);
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }

  update(stats: {
    fps: number;
    frameTime: number;
    tier: string;
    memory?: number;
    drawCalls?: number;
    triangles?: number;
  }) {
    if (!this.visible) return;
    
    const memoryInfo = performance && (performance as any).memory;
    const usedMemory = memoryInfo 
      ? (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1) 
      : 'N/A';
    
    this.container.innerHTML = `
      FPS: ${stats.fps.toFixed(1)}<br>
      Frame: ${stats.frameTime.toFixed(2)}ms<br>
      Tier: ${stats.tier}<br>
      Memory: ${usedMemory} MB<br>
      ${stats.drawCalls ? `Draw Calls: ${stats.drawCalls}<br>` : ''}
      ${stats.triangles ? `Triangles: ${stats.triangles}<br>` : ''}
    `;
  }

  destroy() {
    this.container.remove();
  }
}
```

## Progressive Loading Strategy

```typescript
const LOAD_PRIORITIES = {
  critical: ['engine', 'stadium-basic', 'player-model'],
  high: ['textures-medium', 'audio-sfx'],
  medium: ['textures-high', 'crowd-models'],
  low: ['textures-ultra', 'celebration-anims']
};

async function progressiveLoad(
  onProgress: (stage: string, progress: number) => void
) {
  // Phase 1: Critical (0-2s) - Game playable
  onProgress('critical', 0);
  await loadAssets(LOAD_PRIORITIES.critical);
  onProgress('critical', 100);
  
  // Signal game is ready
  window.dispatchEvent(new Event('gameReady'));
  
  // Phase 2: High priority (background)
  onProgress('high', 0);
  await loadAssets(LOAD_PRIORITIES.high);
  onProgress('high', 100);
  
  // Phase 3-4: Enhancement (lazy)
  requestIdleCallback(async () => {
    await loadAssets(LOAD_PRIORITIES.medium);
    await loadAssets(LOAD_PRIORITIES.low);
    window.dispatchEvent(new Event('fullyLoaded'));
  });
}
```

## Quality Setting Callbacks

```typescript
// Listen for quality changes throughout the app
window.addEventListener('qualityChange', (e: CustomEvent) => {
  const profile = e.detail as DeviceProfile;
  
  // Update renderer
  renderer.shadowMap.enabled = profile.shadowResolution > 0;
  if (profile.shadowResolution > 0) {
    light.shadow.mapSize.setScalar(profile.shadowResolution);
  }
  
  // Update renderer pixel ratio
  const maxPixelRatio = profile.tier === 'high' ? 2 : 
                        profile.tier === 'medium' ? 1.5 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  
  // Update particle systems
  particleSystem.setDensity(profile.particleDensity);
  
  // Update post-processing
  composer.enabled = profile.postProcessing;
});
```

## References

- [Performance Best Practices](https://web.dev/performance/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Stats.js](https://github.com/mrdoob/stats.js/)
- [Battery Status API](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API)
