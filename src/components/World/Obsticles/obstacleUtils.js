import * as THREE from 'three';

/**
 * Traverses a GLTF scene and extracts the first mesh geometry it finds.
 */
export function extractGeometry(gltf) {
  let geometry = null;
  if (gltf && gltf.scene) {
    gltf.scene.traverse((child) => {
      if (child.isMesh && !geometry) {
        geometry = child.geometry;
      }
    });
  }
  return geometry;
}

/**
 * Traverses a GLTF scene and extracts the first mesh material it finds.
 */
export function extractMaterial(gltf) {
  let material = null;
  if (gltf && gltf.scene) {
    gltf.scene.traverse((child) => {
      if (child.isMesh && !material) {
        material = child.material;
      }
    });
  }
  return material;
}
