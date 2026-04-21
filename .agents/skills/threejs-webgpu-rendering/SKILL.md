---
name: threejs-webgpu-rendering
description: Guide for implementing Three.js WebGPU/WebGL rendering with mobile-first optimization. Use this when working with 3D rendering, WebGPU initialization, renderer configuration, or graphics performance.
---

# Three.js WebGPU Rendering for Mobile Games

This skill provides guidance for implementing high-performance 3D rendering using Three.js with WebGPU (primary) and WebGL 2 (fallback) for mobile-first browser games.

## Technology Stack
- **Three.js r182+** with WebGPU support
- **WebGPU API** for modern browsers (iOS 26+, Chrome 121+ Android)
- **WebGL 2.0** fallback for 95%+ device coverage

## WebGPU Feature Detection and Initialization

Always implement progressive enhancement with proper fallbacks:

```typescript
async function initializeRenderer(): Promise<THREE.WebGPURenderer | THREE.WebGLRenderer> {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (adapter) {
        console.log('WebGPU available');
        const renderer = new THREE.WebGPURenderer({ 
          antialias: deviceTier > 1, // Only for flagship devices
          alpha: false,
          stencil: false,
          powerPreference: 'high-performance'
        });
        await renderer.init();
        return renderer;
      }
    } catch (err) {
      console.warn('WebGPU initialization failed:', err);
    }
  }
  
  // Fallback to WebGL 2
  console.log('Using WebGL 2 fallback');
  return new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
}
```

## Mobile-First Renderer Configuration

```typescript
// Dynamic resolution scaling for performance
const pixelRatio = Math.min(window.devicePixelRatio, 2.0);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Use setAnimationLoop for proper frame timing
renderer.setAnimationLoop(animate);

// Tone mapping for better visuals
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
```

## Device Tier Classification

Detect and classify devices for adaptive quality:

| Tier | Devices | Target FPS |
|------|---------|------------|
| 1 (Flagship) | iPhone 14+, Snapdragon 8 Gen 2+, A16+ | 60 fps |
| 2 (Mid-Range) | iPhone SE 2022, Snapdragon 778G, A15 | 45 fps |
| 3 (Budget) | iPhone 11, Snapdragon 695, A13 | 30 fps |

```typescript
function detectDeviceTier(): 'high' | 'medium' | 'low' {
  const gpu = (navigator as any).gpu;
  const memory = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  
  if (gpu && memory >= 8 && cores >= 6) return 'high';
  if (memory >= 4 && cores >= 4) return 'medium';
  return 'low';
}
```

## Level of Detail (LOD) System

Implement LOD for maintaining visual fidelity at distance:

| Distance | Triangles | Texture Res | Shadows |
|----------|-----------|-------------|---------|
| 0-20 units | 8000 | 2048x2048 | Full |
| 20-50 units | 2000 | 1024x1024 | Medium |
| 50+ units | 500 | 512x512 | None |

```typescript
const lod = new THREE.LOD();

// High detail
const highDetail = createMesh(highGeometry, highMaterial);
lod.addLevel(highDetail, 0);

// Medium detail
const mediumDetail = createMesh(mediumGeometry, mediumMaterial);
lod.addLevel(mediumDetail, 20);

// Low detail
const lowDetail = createMesh(lowGeometry, lowMaterial);
lod.addLevel(lowDetail, 50);

scene.add(lod);
```

## Shadow Mapping Configuration

Optimize shadows based on device tier:

```typescript
// WebGPU shadows
light.castShadow = true;

// High tier
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;

// Medium tier
// light.shadow.mapSize.width = 512;

// Low tier - disable shadows
// light.castShadow = false;
```

## Progressive Enhancement Strategy

### WebGPU Available:
- Full visual fidelity with advanced shaders (WGSL)
- Compute-based particle systems
- High-resolution shadow maps (1024x1024)
- Post-processing effects (bloom, depth of field)

### WebGL 2 Fallback:
- Simplified lighting model
- Reduced particle count (50% density)
- Lower shadow resolution (512x512)
- Disabled post-processing

### WebGL 1 Emergency Fallback:
- Basic Phong shading
- No dynamic shadows
- Minimal particles
- Maintain 30fps minimum

## Import Pattern for WebGPU

```typescript
// Use the WebGPU-specific build
import * as THREE from 'three/webgpu';
import { pass, texture, uniform } from 'three/tsl';

// For addons
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

## Performance Optimization Techniques

1. **Geometry Instancing** - For crowds and repeated objects
2. **Texture Atlasing** - Reduce texture binding overhead
3. **Frustum Culling** - Eliminate off-screen draw calls
4. **Dynamic Shadow Resolution** - Based on FPS monitoring
5. **Object Pooling** - Reuse objects to prevent GC
6. **Static Batching** - Mark static objects for optimization

```typescript
// Mark static meshes
mesh.static = true;

// Use instanced meshes for crowds
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
```

## Asset Loading Best Practices

```typescript
// Use Draco compression for GLTF (70% size reduction)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Use Basis Universal for textures (80% reduction)
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('/basis/');
```

## References

- [Three.js WebGPU Examples](https://threejs.org/examples/?q=webgpu)
- [Three.js Documentation](https://threejs.org/docs/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
