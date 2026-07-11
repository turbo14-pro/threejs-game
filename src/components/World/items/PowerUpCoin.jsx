import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
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
  jump:  { color: '#00ff88', emissiveIntensity: 2.0, label: 'Jump' },
  speed: { color: '#ff8800', emissiveIntensity: 2.0, label: 'Speed' },
  dash:  { color: '#4488ff', emissiveIntensity: 2.0, label: 'Dash' },
  slide: { color: '#ff44ff', emissiveIntensity: 2.0, label: 'Slide' },
};

const RARITY_SCALE = {
  bronze:  { scale: 1.0, emissiveMul: 0.8,  metalness: 0.95, roughness: 0.08, emissiveColor: '#ffaa44', bumpScale: 0.25 },
  silver:  { scale: 1.1, emissiveMul: 1.0,  metalness: 0.95, roughness: 0.05, emissiveColor: '#aaddff', bumpScale: 0.30 },
  gold:    { scale: 1.2, emissiveMul: 1.2,  metalness: 0.98, roughness: 0.03, emissiveColor: '#ffcc00', bumpScale: 0.35 },
  diamond: { scale: 1.3, emissiveMul: 1.5,  metalness: 1.0,  roughness: 0.01, emissiveColor: '#44ccff', bumpScale: 0.40 },
};

const COLLECT_DISTANCE = 2.5;

// ---------------------------------------------------------------------------
// PowerUpCoin — drops in, stands on edge, spins, bobs, wobbles
// ---------------------------------------------------------------------------

export function PowerUpCoin({
  spawnPosition = [0, 50, 0],
  category = 'speed',
  rarity = 'bronze',
  bumpTex,
  onCollected,
}) {
  const rigidRef = useRef();
  const standRef = useRef();   // outer group: fixed -90° X rotation (stands coin on edge)
  const wobbleRef = useRef();  // middle group: wobble + bob animation
  const coinRef = useRef();    // inner mesh: spin on face normal
  const [phase, setPhase] = useState('dropping');
  const dropProgress = useRef(0);
  const floatPhase = useRef(Math.random() * Math.PI * 2);
  const targetY = 1.5;

  const catCfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.speed;
  const rarityCfg = RARITY_SCALE[rarity] ?? RARITY_SCALE.bronze;

  // ---- animation + pickup -------------------------------------------------

  useFrame((state, delta) => {
    if (phase === 'collected') return;
    if (!rigidRef.current) return;

    if (phase === 'dropping') {
      dropProgress.current += delta * 0.67;
      if (dropProgress.current >= 1) {
        dropProgress.current = 1;
        setPhase('hovering');
      }
      const t = dropProgress.current;
      const eased = t * t;
      const y = spawnPosition[1] + (targetY - spawnPosition[1]) * eased;
      rigidRef.current.setTranslation(
        { x: spawnPosition[0], y, z: spawnPosition[2] },
        true,
      );
    }

    if (phase === 'hovering') {
      // Float bob on wobble group
      if (wobbleRef.current) {
        const t = state.clock.elapsedTime * 2.0 + floatPhase.current;
        wobbleRef.current.position.y = Math.sin(t) * 0.25;

        // Gentle tilt wobble — additive to the parent's -90° X rotation
        wobbleRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
        wobbleRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.6) * 0.1;
      }

      // Spin on face normal (coin mesh local Y)
      if (coinRef.current) {
        coinRef.current.rotation.y += delta * 2.5;
      }

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
  // standRef: fixed -90° on X → cylinder flat face now vertical (standing on edge)
  // wobbleRef: bob + wobble (additive rotation)
  // coinRef: spin around the face normal

  return (
    <RigidBody
      ref={rigidRef}
      type="fixed"
      position={spawnPosition}
    >
      {/* Outer: stand on edge — never animated */}
      <group ref={standRef} rotation={[Math.PI / 2, 0, 0]}>
        {/* Middle: bob + wobble — rotation is additive to parent */}
        <group ref={wobbleRef}>
          {/* Inner: coin mesh — spins on its local Y (face normal) */}
          <mesh
            ref={coinRef}
            scale={rarityCfg.scale}
            castShadow
          >
            <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
            <meshStandardMaterial
              color={catCfg.color}
              emissive={rarityCfg.emissiveColor}
              emissiveIntensity={catCfg.emissiveIntensity * rarityCfg.emissiveMul}
              metalness={rarityCfg.metalness}
              roughness={rarityCfg.roughness}
              bumpMap={bumpTex}
              bumpScale={rarityCfg.bumpScale}
              envMapIntensity={3}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}
