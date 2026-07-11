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
  jump:  { color: '#00ff88', label: 'Jump' },
  speed: { color: '#ff8800', label: 'Speed' },
  dash:  { color: '#4488ff', label: 'Dash' },
  slide: { color: '#ff44ff', label: 'Slide' },
};

const RARITY_SCALE = {
  bronze:  { scale: 1.0, metalness: 0.95, roughness: 0.08, bumpScale: 0.5 },
  silver:  { scale: 1.1, metalness: 0.95, roughness: 0.05, bumpScale: 0.6 },
  gold:    { scale: 1.2, metalness: 0.98, roughness: 0.03, bumpScale: 0.7 },
  diamond: { scale: 1.3, metalness: 1.0,  roughness: 0.01, bumpScale: 0.8 },
};

const COLLECT_DISTANCE = 2.5;

// Coins are in collision group 1 (bit 1) — camera checks groups 0 and 16 only
const COIN_COLLISION_GROUPS = 0x00000002;

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
  const standRef = useRef();   // outer group: fixed π/2 X rotation (stands coin on edge)
  const wobbleRef = useRef();  // middle group: bob + wobble (additive)
  const coinRef = useRef();    // inner mesh: spin
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

        // Gentle tilt wobble — additive to parent
        wobbleRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
        wobbleRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.6) * 0.1;
      }

      // Spin around vertical axis (world Y = local Z after parent π/2 X rotation)
      if (coinRef.current) {
        coinRef.current.rotation.z += delta * 2.5;
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
  // standRef: fixed π/2 on X → cylinder stands on edge (flat face vertical)
  // wobbleRef: bob + wobble (additive rotation, never overwrites parent)
  // coinRef: spin on local Z = spin around vertical world axis

  return (
    <RigidBody
      ref={rigidRef}
      type="fixed"
      position={spawnPosition}
      collisionGroups={COIN_COLLISION_GROUPS}
    >
      {/* Outer: stand on edge — never animated */}
      <group ref={standRef} rotation={[Math.PI / 2, 0, 0]}>
        {/* Middle: bob + wobble */}
        <group ref={wobbleRef}>
          {/* Inner: coin mesh — spins on local Z (world vertical after parent rotation) */}
          <mesh
            ref={coinRef}
            scale={rarityCfg.scale}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
            <meshPhysicalMaterial
              color={catCfg.color}
              metalness={rarityCfg.metalness}
              roughness={rarityCfg.roughness}
              bumpMap={bumpTex}
              bumpScale={rarityCfg.bumpScale}
              envMapIntensity={3}
              clearcoat={1.0}
              clearcoatRoughness={0.05}
            />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}
