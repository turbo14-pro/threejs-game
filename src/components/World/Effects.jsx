import React from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA } from '@react-three/postprocessing';
import { useGameStore } from '../../store/useGameStore';

export default function Effects() {
  const settings = useGameStore(state => state.settings);

  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {settings.bloom && (
        <Bloom
          intensity={10.0}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.025}
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
          offset={0.1}
          darkness={1.5}
        />
      )}
      {settings.fxaa && (
        <FXAA />
      )}
    </EffectComposer>
  );
}
