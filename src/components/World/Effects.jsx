import React, { useLayoutEffect, useEffect, useMemo, useRef } from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA, SMAA, ToneMapping, N8AO, DepthOfField } from '@react-three/postprocessing';
import { HalfFloatType, Uniform, Vector2, Vector3 } from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { useThree, useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';
import { debugLog } from '../../utils/debugLog.js';
import { ShockwaveEffect } from './Effects/ShockwaveEffect';
import { PostEffectsActivator } from './PostEffectsActivator';

const tempVec = new Vector3();

function RippleDebugProjector() {
  const { camera, gl } = useThree();
  const debugEnabled = useGameStore(state => state.debugRipple.enabled);
  const setRippleDebugScreenPosition = useGameStore(state => state.setRippleDebugScreenPosition);
  const rippleWorldPosition = useGameStore(state => state.debugRipple.worldPosition);

  useFrame(() => {
    if (!debugEnabled) return;
    if (!rippleWorldPosition) return;

    const worldPosition = new Vector3(rippleWorldPosition.x, rippleWorldPosition.y, rippleWorldPosition.z);
    worldPosition.project(camera);

    const width = gl.domElement.clientWidth || 1;
    const height = gl.domElement.clientHeight || 1;
    const x = (worldPosition.x * 0.5 + 0.5) * width;
    const y = (-worldPosition.y * 0.5 + 0.5) * height;

    setRippleDebugScreenPosition({ x, y });
  });

  return null;
}

function RippleDisplacementEffect() {
  const { gl } = useThree();
  const effect = useMemo(() => {
    const fragmentShader = `
      uniform vec2 uCenter;
      uniform float uStrength;
      uniform float uWaveWidth;
      uniform float uRadius;
      uniform float uTime;

      void mainUv(inout vec2 uv) {
        vec2 centered = uv - uCenter;
        float dist = length(centered);
        float wave = exp(-abs(dist - uRadius) / max(uWaveWidth, 0.0001)) * uStrength;
        vec2 displacement = centered * wave;
        uv += displacement;
      }

      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = inputColor;
      }
    `;

    return new Effect('RippleDisplacement', fragmentShader, {
      uniforms: new Map([
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ['uStrength', new Uniform(0.045)],
        ['uWaveWidth', new Uniform(0.04)],
        ['uRadius', new Uniform(0.05)],
        ['uTime', new Uniform(0.0)],
      ]),
    });
  }, []);

  const activeTimer = useRef(0);
  const debugTestTimer = useRef(0);
  const initialDuration = useRef(0.8);
  const wasActive = useRef(false);

  useFrame((state, delta) => {
    // Read fresh state from store every frame
    const storeState = useGameStore.getState();
    const debugEnabled = storeState.debugRipple.enabled;
    const debugScreenPos = storeState.debugRipple.screenPosition;

    // DEBUG: When debugRipple is enabled, auto-trigger ripple every 6 seconds
    if (debugEnabled) {
      debugTestTimer.current += delta;
      if (debugTestTimer.current >= 6.0) {
        debugTestTimer.current = 0;
        storeState.triggerRipple(0.8);
        // Also trigger the blue ShockWave ring at the player's position
        const wp = storeState.debugRipple.worldPosition;
        storeState.addShockwave([wp.x, wp.y, wp.z], 1.0);
        debugLog("🧪 DEBUG: Auto-triggered rippleTimer + shockwave = 0.8s");
      }
    } else {
      debugTestTimer.current = 0;
    }

    // Read fresh rippleTimer directly from store every frame
    const freshRippleTimer = storeState.rippleTimer;

    // Sync from store trigger immediately — but only if we're not already animating
    // This prevents re-triggering while a ripple is already in progress
    if (freshRippleTimer > 0 && activeTimer.current <= 0) {
      activeTimer.current = freshRippleTimer;
      initialDuration.current = freshRippleTimer;
      storeState.setRippleTimer(0); // Reset store timer to prevent constant re-triggering
    } else if (freshRippleTimer > 0) {
      // A trigger came in while we're already animating — discard it to prevent stacking
      storeState.setRippleTimer(0);
    }

    // Determine if active: only render if we have an active timer counting down
    const isActive = activeTimer.current > 0;

    if (!isActive) {
      // Reset uniforms to zero when not active to prevent visual artifacts
      if (wasActive.current) {
        effect.uniforms.get('uStrength').value = 0;
        wasActive.current = false;
      }
      return;
    }
    wasActive.current = true;

    // Decay the timer locally
    activeTimer.current = Math.max(0, activeTimer.current - delta);

    // Determine the center screen position (impact ripple is centered)
    const center = debugEnabled && debugScreenPos
      ? new Vector2(debugScreenPos.x / gl.domElement.clientWidth, 1.0 - (debugScreenPos.y / gl.domElement.clientHeight))
      : new Vector2(0.5, 0.5);

    // Calculate decay factor based on starting duration
    const decay = Math.min(1, activeTimer.current / (initialDuration.current || 0.8));

    effect.uniforms.get('uCenter').value.copy(center);
    effect.uniforms.get('uStrength').value = 0.045 * decay;
    effect.uniforms.get('uWaveWidth').value = 0.04;
    // Radial expansion as decay progresses (from 0.05 to 0.30)
    effect.uniforms.get('uRadius').value = 0.05 + ((1 - decay) * 0.25);
    effect.uniforms.get('uTime').value = state.clock.elapsedTime;
  });

  return <primitive object={effect} />;
}

export default function Effects() {
  const settings = useGameStore(state => state.settings);
  const { camera, gl: renderer, scene } = useThree();

  // Ensure we control clearing manually so depth can be reset between passes
  useEffect(() => {
    renderer.autoClear = false;
    renderer.setClearColor(0, 0, 0, 0);
  }, [renderer]);

  // Main camera should see everything
  useLayoutEffect(() => {
    camera.layers.enableAll();
  }, [camera]);

  // Dynamic focus logic removed for performance

  return (
    <>
      <RippleDebugProjector />
      <EffectComposer disableNormalPass multisampling={0} frameBufferType={HalfFloatType}>
      {/* FXAA MUST BE FIRST to avoid haloing on other passes */}
      {settings.antialiasing === 'FXAA' && <FXAA />}

      {settings.ssao && (
        <N8AO
          aoRadius={2}
          aoSamples={16}
          denoiseSamples={4}
          denoiseRadius={8}
          distanceFalloff={1}
          intensity={1.5}
          color="black"
        />
      )}

      <>
        <ShockwaveEffect index={0} />
        <ShockwaveEffect index={1} />
        <ShockwaveEffect index={2} />
      </>

      <RippleDisplacementEffect />

      {settings.bloom && (
        <Bloom
          intensity={1.0}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          blendFunction={BlendFunction.ADD}
          mipmapBlur={true}
          radius={0.3}
          height={300}
        />
      )}



      {/* Reordered: Vignette and Grain as final aesthetic passes */}
      {settings.vignette && (
        <Vignette
          eskil={false}
          offset={0.1}
          darkness={0.8}
        />
      )}

      {settings.grain && (
        <Noise
          opacity={0.02}
          blendFunction={BlendFunction.OVERLAY}
        />
      )}

      {/* SMAA is typically applied after color/bloom for best results, but before UI/ToneMapping */}
      {settings.antialiasing === 'SMAA' && <SMAA />}

      <ToneMapping />
    </EffectComposer>
    </>
  );
}
