import React, { useEffect, useMemo, useState, memo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGameStore } from '../../store/useGameStore';

/**
 * Performant "Smooth" Shader - Adds soft rim lighting and shadow filling 
 * while preserving original colors.
 */
/**
 * Advanced Character Material Tool:
 * This adds "Rim Lighting" (glowing edges) and "Noise Bumps" (procedural texture).
 * We apply the bumps specifically to materials named 'dark' (the Avo skin).
 */
const applyCharacterMaterials = (material) => {
  material.dithering = true;
  material.flatShading = false;
  
  // Check if this is the 'dark' part of the Avo
  const isDark = material.name.toLowerCase().includes('dark');

  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimIntensity = { value: 0.3 };
    shader.uniforms.bumpScale = { value: isDark ? 0.06 : 0.0 };

    shader.fragmentShader = `
      uniform float rimIntensity;
      uniform float bumpScale;
      
      // Simple noise for the bumpy look
      float getNoise(vec2 p) {
        return fract(sin(dot(p, vec2(12.989, 78.233))) * 43758.545) - 0.5;
      }

      ${shader.fragmentShader}
    `.replace(
      '#include <normal_fragment_begin>',
      `
      #include <normal_fragment_begin>
      if (bumpScale > 0.0) {
        // SAFETY: Only use vUv if the model has UV coordinates defined
        #ifdef USE_UV
          float n = getNoise(vUv * 60.0) * bumpScale;
        #else
          // Fallback to screen space noise if no UVs
          float n = getNoise(gl_FragCoord.xy * 0.1) * bumpScale;
        #endif
        normal = normalize(normal + vec3(n, n, 0.0));
      }
      `
    ).replace(
      '#include <dithering_fragment>',
      `
      // Shadow filling and Rim light
      // Use 'rimNormal' to avoid conflict with the built-in 'vNormal' varying
      vec3 rimNormal = normalize(normal); 
      vec3 viewDir = normalize(-vViewPosition);
      float rim = pow(1.0 - max(dot(rimNormal, viewDir), 0.0), 4.0) * rimIntensity;
      gl_FragColor.rgb += diffuseColor.rgb * rim;
      
      #include <dithering_fragment>
      `
    );
  };
  return material;
};


const PlayerModel = memo(({ isMoving, moveDir, isSprinting, jumpPhase = 'none', config, skinOverride }) => {
  const localSkin = useGameStore(state => state.player.selectedSkin);
  const globalAnimConfig = useGameStore(state => state.player.playerAnimations);
  
  // LOGIC FIX: If skinOverride is provided (even if null/empty), it means this is a remote player.
  // Never default a remote player to the local user's skin!
  const selectedSkin = skinOverride ? skinOverride : (skinOverride === undefined ? localSkin : 'egg');
  const isAvo = selectedSkin === 'avo';

  const activeConfig = useMemo(() => {
    return config || globalAnimConfig || {
      idle: "melee.idle.glb",
      walk_for: "melee.walk.for.glb",
      walk_bac: "melee.walk.bac.glb",
      run_for: "melee.run.for.glb",
      run_bac: "melee.run.bac.glb",
      jump: { file: "melee.jump.glb", launchFrames: 18, landFrames: 20 },
      run_jump: { file: "melee.run.jump.glb", launchFrames: 18, landFrames: 20 }
    };
  }, [config, globalAnimConfig]);

  // Load Models
  const { scene: avoScene } = useGLTF('/skins/skin_avo.glb');
  const { scene: eggScene } = useGLTF('/skins/skin_egg.glb');

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

    const sliceJump = (clips, prefix, config) => {
      const mainClip = clips[0];
      if (!mainClip) return;

      const totalFrames = Math.round(mainClip.duration * FPS);
      const launchEnd = config.launchFrames;
      const loopEnd = config.loopFrames ? (launchEnd + config.loopFrames) : (totalFrames - config.landFrames);
      const landStart = config.loopFrames ? loopEnd : (totalFrames - config.landFrames);

      const launch = THREE.AnimationUtils.subclip(mainClip, `${prefix}_launch`, 0, launchEnd, FPS);
      const loop = THREE.AnimationUtils.subclip(mainClip, `${prefix}_loop`, launchEnd, loopEnd, FPS);
      const land = THREE.AnimationUtils.subclip(mainClip, `${prefix}_land`, landStart, totalFrames, FPS);

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

        // Ensure low poly character geometry is smoothed via normal averaging
        if (node.geometry) {
          // Weld vertices to ensure neighbors share points, allowing smooth normal calculation
          node.geometry = BufferGeometryUtils.mergeVertices(node.geometry);
          node.geometry.computeVertexNormals();
        }

        if (node.material) {
          node.material = node.material.clone();
          applyCharacterMaterials(node.material);
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
        // Use 8 frames (8/30 = 0.266s) for transitions into the loop to avoid jitter
        let fadeTime = 0.2;
        if (animState.includes('launch')) fadeTime = 0.05;
        if (animState.includes('loop')) fadeTime = 8 / 30;
        
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
});

export default PlayerModel;

// Preload everything
useGLTF.preload('/skins/skin_avo.glb');
useGLTF.preload('/skins/skin_egg.glb');
useGLTF.preload(`/skins/actions/melee.idle.glb`);
useGLTF.preload(`/skins/actions/melee.walk.for.glb`);
useGLTF.preload(`/skins/actions/melee.walk.bac.glb`);
useGLTF.preload(`/skins/actions/melee.run.for.glb`);
useGLTF.preload(`/skins/actions/melee.run.bac.glb`);
useGLTF.preload(`/skins/actions/melee.jump.glb`);
useGLTF.preload(`/skins/actions/melee.run.jump.glb`);
