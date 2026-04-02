import React from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA, ToneMapping } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';
import { useGameStore } from '../../store/useGameStore';

export default function Effects() {
  const settings = useGameStore(state => state.settings);

  return (
    <EffectComposer enableNormalPass={false} multisampling={0} frameBufferType={HalfFloatType}>
      {settings.bloom && (
        <Bloom
          intensity={0.5}
          luminanceThreshold={0}
          luminanceSmoothing={0}
          mipmapBlur={false}
          height={300}
        />
      )}
      {settings.grain && (
        <Noise
          opacity={0.5}
        />
      )}
      {settings.vignette && (
        <Vignette
          eskil={false}
          offset={0.3}
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
