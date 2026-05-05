import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';

/**
 * LightRay Component
 * A low-poly cone that emulates a volumetric light beam.
 * Uses a custom optimized shader for noise, fresnel, and fall-off.
 */
export function LightRay({ 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  scale = [1, 1, 1], 
  color = "#CACACA", 
  opacity = 0.02
}) {
  const isVisible = useGameStore(state => state.settings.lightRays);
  const materialRef = useRef();

  const shaderArgs = useMemo(() => ({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uNoiseScale: { value: 5.0 },
      uTimeSpeed: { value: 0.2 },
      uFresnelPower: { value: 3.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uNoiseScale;
      uniform float uTimeSpeed;
      uniform float uFresnelPower;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      // Efficient 2D Hash
      vec2 hash2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
      }

      // 2D Worley Noise with Horizontal Wrapping
      float worleySeamless(vec2 p, float wrap) {
        vec2 n = floor(p);
        vec2 f = fract(p);
        float m_dist = 1.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 cell = n + g;
            
            // This makes the noise repeat horizontally
            cell.x = mod(cell.x, wrap);
            
            vec2 o = hash2(cell);
            vec2 r = g + o - f;
            float d = dot(r, r);
            m_dist = min(m_dist, d);
          }
        }
        return sqrt(m_dist);
      }

      void main() {
        // 1. Fresnel softness (Higher power = softer edges)
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(abs(dot(vNormal, viewDir)), uFresnelPower);
        
        // 2. Seamless 2D Noise
        // X = around the cone, Y = along the cone
        // We multiply Y by a small number (0.1) to stretch the blobs into long rays
        vec2 noiseUv = vec2(vUv.x, vUv.y * 0.1) * uNoiseScale;
        noiseUv.y -= uTime * uTimeSpeed;
        
        // Use our seamless function with the noise scale as the wrap point
        float noise = worleySeamless(noiseUv, uNoiseScale);
        noise = smoothstep(0.4, 0.7, 1.0 - noise);
        
        // 3. Vertical Falloff (Fade top/bottom)
        // Keep your custom fade settings
        float topFade = smoothstep(0.3, 0.7, vUv.y);
        float bottomFade = smoothstep(1.0, 0.5, vUv.y);
        float vertical = topFade * bottomFade;
        
        float finalAlpha = fresnel * noise * vertical * uOpacity;
        
        gl_FragColor = vec4(uColor, finalAlpha);
      }
    `
  }), [color, opacity]);

  // Update time uniform for animation
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!isVisible) return null;

  const noiseScale = 15.0; // Slightly more beams
  const fresnelPower = 1.0; // Much softer edges

  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <coneGeometry args={[1, 1, 8, 1, true]} />
      <shaderMaterial 
        ref={materialRef}
        uniforms={{
          ...shaderArgs.uniforms,
          uNoiseScale: { value: noiseScale },
          uFresnelPower: { value: fresnelPower }
        }}
        vertexShader={shaderArgs.vertexShader}
        fragmentShader={shaderArgs.fragmentShader}
        transparent={true} 
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * ArenaLightRays Component
 * Specific layout for the current Arena level.
 */
export default function ArenaLightRays() {
  return (
    <group name="arena-light-rays">
      {/* End 1: Pointing towards center from Z+ (700) */}
      <LightRay 
        position={[0, 0, 500]} 
        rotation={[.5, 0, 0]} // 135 degrees (Pointed down and toward center)
        scale={[800, 800, 250]} 
        color="#CACACA"
        opacity={1}
      />

      {/* End 2: Pointing towards center from Z- (-700) */}
      <LightRay 
        position={[0, 0, -500]} 
        rotation={[-0.5, 0, 0]} // 45 deg down
        scale={[800, 800, 250]} 
        color="#CACACA"
        opacity={1}
      />
    </group>
  );
}
