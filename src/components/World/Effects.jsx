import React from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA, ToneMapping } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';
import { BlendFunction } from 'postprocessing';
import { useGameStore } from '../../store/useGameStore';

export default function Effects() {
  const settings = useGameStore(state => state.settings);

  return (
    <EffectComposer enableNormalPass={false} multisampling={0} frameBufferType={HalfFloatType}>
      {settings.grain && (
        <Noise
          opacity={0.02}
        />
      )}
      {settings.vignette && (
        <Vignette
          eskil={false}
          offset={0.1}
          darkness={0.2}
        />
      )}
      {settings.fxaa && (
        <FXAA />
      )}
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
      <ToneMapping />
    </EffectComposer>
  );
}
