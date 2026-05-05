import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA, SMAA, ToneMapping, SSAO, DepthOfField } from '@react-three/postprocessing';
import { HalfFloatType, Vector3 } from 'three';
import { BlendFunction } from 'postprocessing';
import { useThree, useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';
import { ShockwaveEffect } from './Effects/ShockwaveEffect';

const tempVec = new Vector3();

export default function Effects() {
  const settings = useGameStore(state => state.settings);
  const shockwaves = useGameStore(state => state.shockwaves || []);
  const { camera, gl: renderer, scene } = useThree();
  const playerRef = useRef();

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
    <EffectComposer disableNormalPass={!settings.ssao} multisampling={0} frameBufferType={HalfFloatType}>
      {/* FXAA MUST BE FIRST to avoid haloing on other passes */}
      {settings.antialiasing === 'FXAA' && <FXAA />}

      {settings.ssao && (
        <SSAO
          intensity={15}
          radius={0.05}
          luminanceInfluence={0.6}
          color="black"
        />
      )}

      {settings.shockwave && shockwaves.map((sw) => (
        <ShockwaveEffect key={sw.id} position={sw.position} />
      ))}

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
  );
}
