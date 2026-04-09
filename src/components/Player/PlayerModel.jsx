import React, { useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useGameStore } from '../../store/useGameStore';

/**
 * Performant "Smooth" Shader - Adds soft rim lighting and shadow filling 
 * while preserving original colors.
 */
const applySmoothShader = (material) => {
  if (material.normalMap) material.normalScale.set(1.5, 1.5);
  if (material.bumpMap) material.bumpScale = 0.02;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimIntensity = { value: 0.4 };
    shader.fragmentShader = `
      uniform float rimIntensity;
      ${shader.fragmentShader}
    `.replace(
      '#include <dithering_fragment>',
      `
      float vDotN = 1.0 - max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.0);
      float rim = pow(vDotN, 5.0) * rimIntensity;
      gl_FragColor.rgb += diffuseColor.rgb * rim;
      float bounce = max(0.0, dot(vNormal, vec3(0.0, 1.0, 0.0)));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb + (diffuseColor.rgb * 0.1), (1.0 - bounce) * 0.1);
      #include <dithering_fragment>
      `
    );
  };
  return material;
};


export default function PlayerModel({ isMoving, moveDir, isSprinting, jumpPhase = 'none', config }) {
  const selectedCharacter = useGameStore(state => state.selectedCharacter);
  const isAvo = selectedCharacter === 'Avo';

  const activeConfig = useMemo(() => {
    return config || {
      idle: "melee.idle.glb",
      walk_for: "melee.walk.for.glb",
      walk_bac: "melee.walk.bac.glb",
      run_for: "melee.run.for.glb",
      run_bac: "melee.run.bac.glb",
      jump: { file: "melee.jump.glb", launchFrames: 18, landFrames: 20 },
      run_jump: { file: "melee.run.jump.glb", launchFrames: 18, landFrames: 20 }
    };
  }, [config]);

  // Load Models
  const { scene: avoScene } = useGLTF('/skins/avo.glb');
  const { scene: eggScene } = useGLTF('/skins/egg.glb');

  // Load Animation Files
  const { animations: idleClips } = useGLTF(`/skins/actions/${activeConfig.idle}`);
  const { animations: walkForClips } = useGLTF(`/skins/actions/${activeConfig.walk_for}`);
  const { animations: walkBacClips } = useGLTF(`/skins/actions/${activeConfig.walk_bac}`);
  const { animations: runForClips } = useGLTF(`/skins/actions/${activeConfig.run_for}`);
  const { animations: runBacClips } = useGLTF(`/skins/actions/${activeConfig.run_bac}`);
  const { animations: jumpFileClips } = useGLTF(`/skins/actions/${activeConfig.jump.file}`);
  const { animations: runJumpFileClips } = useGLTF(`/skins/actions/${activeConfig.run_jump.file}`);

  const sourceScene = isAvo ? avoScene : eggScene;
  const scale = 2.0;

  const processedAnimations = useMemo(() => {
    const allClips = [];
    const FPS = 30;

    // Helper to add titled clips
    const addClips = (clips, prefix) => {
      clips.forEach((clip, i) => {
        const c = clip.clone();
        c.name = `${prefix}_${i}`;
        allClips.push(c);
      });
    };

    // Standard Loops
    addClips(idleClips, 'idle');
    addClips(walkForClips, 'walk_for');
    addClips(walkBacClips, 'walk_bac');
    addClips(runForClips, 'run_for');
    addClips(runBacClips, 'run_bac');

    // Slice Jump Actions
    const sliceJump = (clips, prefix, config) => {
      const mainClip = clips[0];
      if (!mainClip) return;

      const totalFrames = Math.floor(mainClip.duration * FPS);
      
      const launch = THREE.AnimationUtils.subclip(mainClip, `${prefix}_launch`, 0, config.launchFrames, FPS);
      const loop = THREE.AnimationUtils.subclip(mainClip, `${prefix}_loop`, config.launchFrames, totalFrames - config.landFrames, FPS);
      const land = THREE.AnimationUtils.subclip(mainClip, `${prefix}_land`, totalFrames - config.landFrames, totalFrames, FPS);

      allClips.push(launch, loop, land);
    };

    sliceJump(jumpFileClips, 'jump', activeConfig.jump);
    sliceJump(runJumpFileClips, 'run_jump', activeConfig.run_jump);

    return allClips;
  }, [idleClips, walkForClips, walkBacClips, runForClips, runBacClips, jumpFileClips, runJumpFileClips, activeConfig]);

  const clone = useMemo(() => {
    const clonedScene = SkeletonUtils.clone(sourceScene);
    clonedScene.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material = node.material.clone();
          applySmoothShader(node.material);
        }
      }
    });
    return clonedScene;
  }, [sourceScene]);

  // Robust manual mixer and actions management
  const mixer = useMemo(() => new THREE.AnimationMixer(clone), [clone]);
  
  const actions = useMemo(() => {
    const dict = {};
    processedAnimations.forEach(clip => {
      const action = mixer.clipAction(clip);
      dict[clip.name] = action;
    });
    return dict;
  }, [mixer, processedAnimations]);

  const prevAction = React.useRef(null);
  const prevTargetKey = React.useRef(null);

  // Stop everything if mixer changes
  useEffect(() => {
    return () => {
      if (mixer) mixer.stopAllAction();
    };
  }, [mixer]);

  let animState = 'idle';
  if (jumpPhase === 'none') {
    if (isMoving) {
      animState = isSprinting ? `run_${moveDir}` : `walk_${moveDir}`;
    } else {
      animState = 'idle';
    }
  } else {
    const activeJumpPrefix = isSprinting ? 'run_jump' : 'jump';
    const phase = jumpPhase === 'air' ? 'loop' : jumpPhase;
    animState = `${activeJumpPrefix}_${phase}`;
  }

  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;

    const keys = Object.keys(actions);
    const targetKey = keys.find(k => k.startsWith(animState)) || keys[0];
    const action = actions[targetKey];

    if (action && (prevTargetKey.current !== targetKey || !prevAction.current)) {
      // New action or first action for this mixer
      action.reset();
      action.setEffectiveWeight(1);
      action.play();

      if (prevAction.current && prevAction.current.getMixer() === mixer) {
        const fadeTime = animState.includes('launch') ? 0.05 : 0.2;
        prevAction.current.crossFadeTo(action, fadeTime, true);
      }

      if (animState.includes('launch') || animState.includes('land')) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }

      prevAction.current = action;
      prevTargetKey.current = targetKey;
    }

    if (action) {
      let speedScale = 1.0;
      if (animState.includes('walk')) speedScale = 1.3;
      if (animState.includes('run')) speedScale = 1.2;
      if (animState.includes('land')) speedScale = 1.6;
      action.setEffectiveTimeScale(speedScale);
    }
  }, [actions, animState, mixer]);

  useFrame((state, delta) => {
    if (mixer) mixer.update(delta);
  });

  return <primitive object={clone} scale={[scale, scale, scale]} />;
}

// Preload everything
useGLTF.preload('/skins/avo.glb');
useGLTF.preload('/skins/egg.glb');
useGLTF.preload(`/skins/actions/melee.idle.glb`);
useGLTF.preload(`/skins/actions/melee.walk.for.glb`);
useGLTF.preload(`/skins/actions/melee.walk.bac.glb`);
useGLTF.preload(`/skins/actions/melee.run.for.glb`);
useGLTF.preload(`/skins/actions/melee.run.bac.glb`);
useGLTF.preload(`/skins/actions/melee.jump.glb`);
useGLTF.preload(`/skins/actions/melee.run.jump.glb`);
