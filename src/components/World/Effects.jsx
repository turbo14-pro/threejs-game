import React from 'react';
import { Bloom, Noise, Vignette, EffectComposer, FXAA } from '@react-three/postprocessing';
import { useGameStore } from '../../store/useGameStore';

export default function Effects() {
  const settings = useGameStore(state => state.settings);

  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {settings.bloom && (
        <Bloom
          intensity={1.0}
          luminanceThreshold={0.5}
          luminanceSmoothing={1}
          mipmapBlur={true}
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
          offset={1}
          darkness={1.5}
        />
      )}
      {settings.fxaa && (
        <FXAA />
      )}
    </EffectComposer>
  );
}
