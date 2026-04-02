import React, { useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { useGameStore } from '../../store/useGameStore';

/**
 * Performant "Smooth" Shader - Adds soft rim lighting and shadow filling 
 * without the overhead of Physical materials.
 */
const applySmoothShader = (material) => {
  material.roughness = 0.4;
  material.metalness = 0.1;
  
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color('#ffffff') };
    shader.fragmentShader = `
      uniform vec3 rimColor;
      ${shader.fragmentShader}
    `.replace(
      '#include <dithering_fragment>',
      `
      // Soft Rim
      float rim = 1.0 - max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.0);
      gl_FragColor.rgb += rimColor * pow(rim, 4.0) * 0.3;
      
      // Shadow Softener (Fake GI)
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb + vec3(0.05, 0.05, 0.075), 1.0 - max(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)), 0.0) * 0.15);
      
      #include <dithering_fragment>
      `
    );
  };
  return material;
};

export default function PlayerModel({ isMoving, isSprinting }) {
  const selectedCharacter = useGameStore(state => state.selectedCharacter);

  const modelPath = selectedCharacter === 'Avo' ? '/models/Avo.glb' : '/models/EGG.glb';
  const scale = 2.0;

  const { scene, animations } = useGLTF(modelPath);
  
  // Clone the scene and apply the performant smooth shader
  const clone = useMemo(() => {
    const clonedScene = SkeletonUtils.clone(scene);
    clonedScene.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          applySmoothShader(node.material);
        }
      }
    });
    return clonedScene;
  }, [scene]);

  const { actions } = useAnimations(animations, clone);

  useEffect(() => {
    if (!actions) return;
    
    const keys = Object.keys(actions);
    const idleKey = keys.find(k => k.toLowerCase().includes('idle'));
    const walkKey = keys.find(k => k.toLowerCase().includes('walk'));

    const targetKey = isMoving ? walkKey : idleKey;
    const action = actions[targetKey];

    if (action) {
      action.reset().fadeIn(0.2).play();
      action.timeScale = isSprinting ? 2.5 : 1.0;
      
      return () => { action.fadeOut(0.2); };
    }
  }, [actions, isMoving, isSprinting]);

  return <primitive object={clone} scale={[scale, scale, scale]} />;
}

useGLTF.preload('/models/Avo.glb');
useGLTF.preload('/models/EGG.glb');
