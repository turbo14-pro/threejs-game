import React, { useEffect, useMemo, useState, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
const applyCharacterMaterials = (material) => {
  material.dithering = true;
  material.flatShading = false;
  
  const isDark = material.name.toLowerCase().includes('dark');

  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimIntensity = { value: 0.3 };
    shader.uniforms.bumpScale = { value: isDark ? 0.2 : 0.0 }; // stronger bump for dark material

    shader.fragmentShader = `
      uniform float rimIntensity;
      uniform float bumpScale;
      float getNoise(vec2 p) {
        return fract(sin(dot(p, vec2(12.989, 78.233))) * 43758.545) - 0.5;
      }
      ${shader.fragmentShader}
    `.replace(
      '#include <normal_fragment_begin>',
      `
      #include <normal_fragment_begin>
      if (bumpScale > 0.0) {
        #ifdef USE_UV
          float n = getNoise(vUv * 60.0) * bumpScale;
        #else
          float n = getNoise(gl_FragCoord.xy * 0.1) * bumpScale;
        #endif
        normal = normalize(normal + vec3(n, n, 0.0));
      }
      `
    ).replace(
      '#include <dithering_fragment>',
      `
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

const PlayerModel = ({ isMoving, moveDir, isSprinting, jumpPhase = 'none', isSliding = false, config, skinOverride }) => {
  const { localSkin, globalAnimConfig } = useGameStore(useShallow(state => ({
    localSkin: state.player.selectedSkin,
    globalAnimConfig: state.player.playerAnimations
  })));
  
  // If no skin is provided by the server, we use 'avo' as the base look.
  // We only use the local skin if this is our own character (skinOverride is undefined).
  const selectedSkin = skinOverride || (skinOverride === undefined ? localSkin : 'avo');
  
  const isAvo = selectedSkin === 'avo';

  const activeConfig = useMemo(() => {
    return config || globalAnimConfig || {
      idle: "melee.idle.glb",
      walk_for: "melee.walk.for.glb",
      walk_bac: "melee.walk.bac.glb",
      run_for: "melee.run.for.glb",
      run_bac: "melee.run.bac.glb",
      slide: "melee.slide.glb",
      doublejump: { file: "melee.doublejump.glb", frames: 20 },
      doublejump_back: { file: "melee.doublejumpback.glb", frames: 27 },
      jump: { file: "melee.jump.glb", launchFrames: 4, landFrames: 10 },
      run_jump: { file: "melee.run.jump.glb", launchFrames: 4, landFrames: 10 }
    };
  }, [config, JSON.stringify(globalAnimConfig)]);

  const { scene: avoScene } = useGLTF('/skins/skin_avo.glb');
  const { scene: eggScene } = useGLTF('/skins/skin_egg.glb');

  const { animations: idleClips } = useGLTF(`/skins/actions/${activeConfig.idle}`);
  const { animations: walkForClips } = useGLTF(`/skins/actions/${activeConfig.walk_for}`);
  const { animations: walkBacClips } = useGLTF(`/skins/actions/${activeConfig.walk_bac}`);
  const { animations: runForClips } = useGLTF(`/skins/actions/${activeConfig.run_for}`);
  const { animations: runBacClips } = useGLTF(`/skins/actions/${activeConfig.run_bac}`);
  const { animations: slideClips } = useGLTF(`/skins/actions/${activeConfig.slide || 'melee.slide.glb'}`);
  
  const djFile = activeConfig.doublejump?.file || (typeof activeConfig.doublejump === 'string' ? activeConfig.doublejump : 'melee.doublejump.glb');
  const djbFile = activeConfig.doublejump_back?.file || (typeof activeConfig.doublejump_back === 'string' ? activeConfig.doublejump_back : 'melee.doublejumpback.glb');
  
  const { animations: doubleJumpClips } = useGLTF(`/skins/actions/${djFile}`);
  const { animations: doubleJumpBacClips } = useGLTF(`/skins/actions/${djbFile}`);
  
  const { animations: jumpFileClips } = useGLTF(`/skins/actions/${activeConfig.jump.file}`);
  const { animations: runJumpFileClips } = useGLTF(`/skins/actions/${activeConfig.run_jump.file}`);

  const sourceScene = isAvo ? avoScene : eggScene;
  const scale = 2.0;

  const actionsRef = React.useRef({});
  const prevAnimState = React.useRef(null);
  
  const clone = useMemo(() => {
    if (!sourceScene) return null;
    const c = SkeletonUtils.clone(sourceScene);
    c.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return c;
  }, [sourceScene]);

  // Determine the correct animation state based on movement and jump status
  const animState = useMemo(() => {
    if (jumpPhase === 'doublejump') {
      return moveDir === 'bac' ? 'doublejump_back' : 'doublejump';
    }
    if (jumpPhase !== 'none') {
      const jumpPrefix = isSprinting ? 'run_jump' : 'jump';
      // Map 'air' to 'loop' to match our subclip naming
      const phase = jumpPhase === 'air' ? 'loop' : jumpPhase;
      return `${jumpPrefix}_${phase}`;
    }
    if (isSliding) {
      return 'slide';
    }
    if (isMoving) {
      const movePrefix = isSprinting ? 'run' : 'walk';
      return `${movePrefix}_${moveDir}`;
    }
    return 'idle';
  }, [isMoving, isSprinting, jumpPhase, moveDir, isSliding]);
  // 1. Initialize Mixer
  const mixer = useMemo(() => {
    if (!clone) return null;
    return new THREE.AnimationMixer(clone);
  }, [clone]);

  // 2. Setup Actions ONCE per mixer/config
  useEffect(() => {
    if (!mixer || !idleClips) return;
    
    mixer.stopAllAction();
    const newActions = {};
    const FPS = 30;

    const processClips = (clips, prefix) => {
      if (!clips) return;
      clips.forEach((clip, i) => {
        const c = clip.clone();
        c.name = `${prefix}_${i}`;
        c.tracks.forEach(track => {
          if (track.name.includes('.')) {
            const parts = track.name.split('.');
            if (parts.length > 2) {
              track.name = parts.slice(-2).join('.');
            }
          }
        });
        newActions[c.name] = mixer.clipAction(c);
      });
    };

    const processJump = (clips, prefix, cfg) => {
      if (!clips || !clips[0]) return;
      const mainClip = clips[0];
      const totalFrames = Math.round(mainClip.duration * FPS);
      const launchEnd = cfg.launchFrames;
      const loopEnd = cfg.loopFrames ? (launchEnd + cfg.loopFrames) : (totalFrames - cfg.landFrames);
      const landStart = cfg.loopFrames ? loopEnd : (totalFrames - cfg.landFrames);
      
      const launch = THREE.AnimationUtils.subclip(mainClip, `${prefix}_launch_0`, 0, launchEnd, FPS);
      const loop = THREE.AnimationUtils.subclip(mainClip, `${prefix}_loop_0`, launchEnd, loopEnd, FPS);
      const land = THREE.AnimationUtils.subclip(mainClip, `${prefix}_land_0`, landStart, totalFrames, FPS);
      
      [launch, loop, land].forEach(c => {
        c.tracks.forEach(track => {
          if (track.name.includes('.')) {
            const parts = track.name.split('.');
            if (parts.length > 2) {
              track.name = parts.slice(-2).join('.');
            }
          }
        });
        newActions[c.name] = mixer.clipAction(c);
      });
    };

    processClips(idleClips, 'idle');
    processClips(walkForClips, 'walk_for');
    processClips(walkBacClips, 'walk_bac');
    processClips(runForClips, 'run_for');
    processClips(runBacClips, 'run_bac');
    processClips(slideClips, 'slide');
    processClips(doubleJumpClips, 'doublejump');
    processClips(doubleJumpBacClips, 'doublejump_back');
    processJump(jumpFileClips, 'jump', activeConfig.jump);
    processJump(runJumpFileClips, 'run_jump', activeConfig.run_jump);

    actionsRef.current = newActions;
    
    // Play idle by default if nothing is playing
    if (newActions['idle_0']) {
      newActions['idle_0'].play();
      prevAnimState.current = 'idle_0';
    }

    return () => { 
      if (mixer) mixer.stopAllAction(); 
    };
  }, [mixer, idleClips, walkForClips, walkBacClips, runForClips, runBacClips, slideClips, doubleJumpClips, doubleJumpBacClips, jumpFileClips, runJumpFileClips, activeConfig, JSON.stringify(activeConfig)]);


  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions || Object.keys(actions).length === 0) return;

    const keys = Object.keys(actions);
    const targetKey = keys.find(k => k.startsWith(animState)) || keys[0];
    const action = actions[targetKey];
    const prevAction = actions[prevAnimState.current];

    if (!action) return;

    if (prevAnimState.current !== targetKey) {
      let fadeTime = 0.2;
      if (animState.includes('launch')) fadeTime = 0.05;
      if (animState.includes('loop')) fadeTime = 2 / 30;

      if (prevAction) {
        prevAction.fadeOut(fadeTime);
      }
      
      action.reset();
      action.setEffectiveWeight(1);
      action.fadeIn(fadeTime);
      action.play();

      if (animState.includes('launch') || animState.includes('land') || animState.includes('doublejump') || animState === 'slide') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      
      prevAnimState.current = targetKey;
    }

    // Always update speed
    let speedScale = 1.0;
    if (animState.includes('walk')) speedScale = 1.3;
    if (animState.includes('run')) speedScale = 1.2;
    if (animState.includes('land')) speedScale = 1.6;
    
    action.setEffectiveTimeScale(speedScale);

  }, [animState, activeConfig, mixer]);

  useFrame((state, delta) => {
    if (mixer) mixer.update(delta);
  });

  return <primitive object={clone} scale={[scale, scale, scale]} />;
};

export default memo(PlayerModel);

useGLTF.preload('/skins/skin_avo.glb');
useGLTF.preload('/skins/skin_egg.glb');
useGLTF.preload(`/skins/actions/melee.idle.glb`);
useGLTF.preload(`/skins/actions/melee.walk.for.glb`);
useGLTF.preload(`/skins/actions/melee.walk.bac.glb`);
useGLTF.preload(`/skins/actions/melee.run.for.glb`);
useGLTF.preload(`/skins/actions/melee.run.bac.glb`);
useGLTF.preload(`/skins/actions/melee.slide.glb`);
useGLTF.preload(`/skins/actions/melee.doublejump.glb`);
useGLTF.preload(`/skins/actions/melee.doublejumpback.glb`);
useGLTF.preload(`/skins/actions/melee.jump.glb`);
useGLTF.preload(`/skins/actions/melee.run.jump.glb`);
