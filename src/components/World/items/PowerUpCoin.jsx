import { useRef, useState, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../../store/useGameStore';

// ---------------------------------------------------------------------------
// Shared player position (written by PlayerController each frame)
// ---------------------------------------------------------------------------

const _playerPos = new THREE.Vector3();
export const setLocalPlayerWorldPos = (v) => _playerPos.copy(v);

// ---------------------------------------------------------------------------
// Configuration maps
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG = {
  jump:  { color: '#00ff88', emissiveIntensity: 2.0, label: 'Jump',  bumpMap: '/materials/items/powerup.jump.svg' },
  speed: { color: '#ff8800', emissiveIntensity: 2.0, label: 'Speed', bumpMap: '/materials/items/powerup.run.svg' },
  dash:  { color: '#4488ff', emissiveIntensity: 2.0, label: 'Dash',  bumpMap: '/materials/items/powerup.dash.svg' },
  slide: { color: '#ff44ff', emissiveIntensity: 2.0, label: 'Slide', bumpMap: '/materials/items/powerup.slide.svg' },
};

const RARITY_SCALE = {
  bronze:  { scale: 1.0, emissiveMul: 0.8,  metalness: 0.4, roughness: 0.6, emissiveColor: '#ffaa44', bumpScale: 0.03 },
  silver:  { scale: 1.1, emissiveMul: 1.0,  metalness: 0.7, roughness: 0.3, emissiveColor: '#aaddff', bumpScale: 0.04 },
  gold:    { scale: 1.2, emissiveMul: 1.2,  metalness: 0.8, roughness: 0.2, emissiveColor: '#ffcc00', bumpScale: 0.05 },
  diamond: { scale: 1.3, emissiveMul: 1.5,  metalness: 0.9, roughness: 0.1, emissiveColor: '#44ccff', bumpScale: 0.06 },
};

const COLLECT_DISTANCE = 2.5;

// ---------------------------------------------------------------------------
// SVG bump map loader — loads all 4 bump maps once at module level
// ---------------------------------------------------------------------------

function useBumpMaps() {
  const [dash, jump, run, slide] = useLoader(THREE.TextureLoader, [
    '/materials/items/powerup.dash.svg',
    '/materials/items/powerup.jump.svg',
    '/materials/items/powerup.run.svg',
    '/materials/items/powerup.slide.svg',
  ]);

  // Configure textures for bump mapping
  return useMemo(() => {
    const textures = { dash, speed: run, jump, slide };
    Object.values(textures).forEach((tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.center.set(0.5, 0.5);
    });
    return textures;
  }, [dash, jump, run, slide]);
}

// ---------------------------------------------------------------------------
// PowerUpCoin — drops in with animated physics, then hovers and spins
// ---------------------------------------------------------------------------

export function PowerUpCoin({
  spawnPosition = [0, 50, 0],
  category = 'speed',
  rarity = 'bronze',
  onCollected,
}) {
  const rigidRef = useRef();
  const meshRef = useRef();
  const [phase, setPhase] = useState('dropping'); // 'dropping' | 'hovering' | 'collected'
  const dropProgress = useRef(0);
  const floatPhase = useRef(Math.random() * Math.PI * 2);
  const targetY = 1.5;

  const catCfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.speed;
  const rarityCfg = RARITY_SCALE[rarity] ?? RARITY_SCALE.bronze;

  // Load bump maps (suspended until textures are ready)
  const bumpMaps = useBumpMaps();
  const bumpTex = bumpMaps[category] ?? bumpMaps.speed;

  // ---- animation + pickup -------------------------------------------------

  useFrame((state, delta) => {
    if (phase === 'collected') return;
    if (!rigidRef.current) return;

    if (phase === 'dropping') {
      dropProgress.current += delta * 0.67; // ~1.5s total
      if (dropProgress.current >= 1) {
        dropProgress.current = 1;
        setPhase('hovering');
      }
      // Gravity acceleration curve (ease-in)
      const t = dropProgress.current;
      const eased = t * t;
      const y = spawnPosition[1] + (targetY - spawnPosition[1]) * eased;
      rigidRef.current.setTranslation(
        { x: spawnPosition[0], y, z: spawnPosition[2] },
        true,
      );
    }

    if (phase === 'hovering' && meshRef.current) {
      // Spin
      meshRef.current.rotation.y += delta * 2.5;

      // Gentle tilt wobble
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
      meshRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.6) * 0.1;

      // Float bob
      const t = state.clock.elapsedTime * 2.0 + floatPhase.current;
      meshRef.current.position.y = Math.sin(t) * 0.25;

      // Distance-based pickup check
      const coinPos = rigidRef.current.translation();
      const dx = coinPos.x - _playerPos.x;
      const dy = coinPos.y - _playerPos.y;
      const dz = coinPos.z - _playerPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < COLLECT_DISTANCE * COLLECT_DISTANCE) {
        useGameStore.getState().collectPowerUp(category, rarity);
        setPhase('collected');
        onCollected?.();
      }
    }
  });

  if (phase === 'collected') return null;

  // ---- render -------------------------------------------------------------

  return (
    <RigidBody
      ref={rigidRef}
      type="fixed"
      position={spawnPosition}
    >
      <mesh
        ref={meshRef}
        scale={rarityCfg.scale}
        castShadow
      >
        {/* Cylinder coin: radius=0.5, height=0.12 (thin disc) */}
        <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
        <meshStandardMaterial
          color={catCfg.color}
          emissive={rarityCfg.emissiveColor}
          emissiveIntensity={catCfg.emissiveIntensity * rarityCfg.emissiveMul}
          metalness={rarityCfg.metalness}
          roughness={rarityCfg.roughness}
          bumpMap={bumpTex}
          bumpScale={rarityCfg.bumpScale}
          side={THREE.DoubleSide}
        />
      </mesh>
    </RigidBody>
  );
}
