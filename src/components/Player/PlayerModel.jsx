import React, { useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { useGameStore } from '../../store/useGameStore';

export default function PlayerModel({ isMoving, isSprinting }) {
  const selectedCharacter = useGameStore(state => state.selectedCharacter);

  const modelPath = selectedCharacter === 'Avo' ? '/models/Avo.glb' : '/models/EGG.glb';
  const scale = 2.0;

  const { scene, animations } = useGLTF(modelPath);
  
  // Clone the scene to avoid bone sharing/animation bleeding between models
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);
  const { actions } = useAnimations(animations, clone);

  useEffect(() => {
    // Traverse and enable shadows on the clone
    clone.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }, [clone]);

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
