import React, { useRef, useEffect, forwardRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Effect } from 'postprocessing';
import { useGameStore } from '../../../store/useGameStore';
import { getActionIntensity, PLAYER_BASELINE } from '../../../config/playerConfig';

const fragmentShader = `
uniform float uIntensity;
uniform float uSamples;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = uv - center;
  float dist = length(dir);

  vec4 color = vec4(0.0);
  float total = 0.0;

  for (float i = 0.0; i < 32.0; i++) {
    if (i >= uSamples) break;
    float t = i / uSamples;
    float scale = 1.0 + t * dist * uIntensity;
    vec2 sampleUv = center + dir * scale;
    // Clamp to screen
    sampleUv = clamp(sampleUv, vec2(0.0), vec2(1.0));
    color += texture2D(inputBuffer, sampleUv);
    total += 1.0;
  }

  outputColor = color / total;
}
`;

class RadialBlur extends Effect {
  constructor({ intensity = 0.0, samples = 16.0 } = {}) {
    super('RadialBlur', fragmentShader, {
      uniforms: new Map([
        ['uIntensity', { value: intensity }],
        ['uSamples', { value: samples }],
      ]),
    });
  }

  update(renderer, inputBuffer, deltaTime) {
    // Intensity is updated via uniforms from React
  }
}

const RadialBlurEffect = forwardRef(function RadialBlurEffect(props, ref) {
  const powerUp = useGameStore(state => state.powerUp);
  const playerIsMoving = useGameStore(state => state.playerIsMoving);
  const playerIsDashing = useGameStore(state => state.playerIsDashing);
  const effectRef = useRef();

  const effect = useMemo(() => new RadialBlur({ intensity: 0.0, samples: 16.0 }), []);

  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useFrame(() => {
    // Determine target intensity based on active power-up category
    // Speed blur only active when player is actually moving (running)
    // Dash blur only active when player is in dash state
    let targetIntensity = 0;
    if (powerUp) {
      if (powerUp.category === 'dash' && playerIsDashing) {
        targetIntensity = getActionIntensity('dashBoost', powerUp.rarity);
      } else if (powerUp.category === 'speed' && playerIsMoving) {
        targetIntensity = getActionIntensity('speedBoost', powerUp.rarity);
      }
    }
    const current = effect.uniforms.get('uIntensity').value;
    // Smooth lerp using configurable speed
    effect.uniforms.get('uIntensity').value += (targetIntensity - current) * PLAYER_BASELINE.radialBlur.lerpSpeed;
  });

  return <primitive ref={ref || effectRef} object={effect} />;
});

export default RadialBlurEffect;
