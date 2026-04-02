import React from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA, ToneMapping } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';
import { BlendFunction } from 'postprocessing';
import { useGameStore } from '../../store/useGameStore';

export default function Effects() {
  const settings = useGameStore(state => state.settings);

  return (
    <EffectComposer enableNormalPass={false} multisampling={8} frameBufferType={HalfFloatType}>
      {settings.bloom && (
        <Bloom
          intensity={1.0}
          luminanceThreshold={0}
          luminanceSmoothing={1}
          blendFunction={BlendFunction.ADD}
          mipmapBlur={true}
          radius={0.4}
        />
      )}
      {settings.grain && (
        <Noise
          opacity={0.05}
        />
      )}
      {settings.vignette && (
        <Vignette
          eskil={false}
          offset={0.4}
          darkness={0.4}
        />
      )}
      {settings.fxaa && (
        <FXAA />
      )}
      <ToneMapping />
    </EffectComposer>
  );
}
