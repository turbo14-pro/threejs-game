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
  jump:  { color: '#00ff88', iconColor: '#ffffff', label: 'Jump' },
  speed: { color: '#ff8800', iconColor: '#ffffff', label: 'Speed' },
  dash:  { color: '#4488ff', iconColor: '#ffffff', label: 'Dash' },
  slide: { color: '#ff44ff', iconColor: '#ffffff', label: 'Slide' },
};

const RARITY_SCALE = {
  bronze:  { scale: 1.0, metalness: 0.95, roughness: 0.08 },
  silver:  { scale: 1.1, metalness: 0.95, roughness: 0.05 },
  gold:    { scale: 1.2, metalness: 0.98, roughness: 0.03 },
  diamond: { scale: 1.3, metalness: 1.0,  roughness: 0.01 },
};

const COLLECT_DISTANCE = 2.5;
const COIN_COLLISION_GROUPS = 0x00000002;

// Icon render resolution
const ICON_SIZE = 512;

// ---------------------------------------------------------------------------
// SVG → high-res canvas texture with effects
// ---------------------------------------------------------------------------

function renderIconToCanvas(svgUrl, color, rotationDeg = 0) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = ICON_SIZE;
      canvas.height = ICON_SIZE;
      const ctx = canvas.getContext('2d');

      // Transparent background
      ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

      // Rotate and draw centered
      ctx.save();
      ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      // Scale SVG up to fill canvas with padding
      const drawSize = ICON_SIZE * 0.75;
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();

      // Drop shadow (dark offset shadow for depth)
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
      ctx.restore();

      // Re-draw icon on top for sharpness (overlay pass)
      ctx.save();
      ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.src = svgUrl;
  });
}

// Pre-built icon textures per category (loaded once at module init)
const iconTextures = {};
const iconPromises = Object.entries({
  jump:  '/materials/items/powerup.jump.svg',
  speed: '/materials/items/powerup.run.svg',
  dash:  '/materials/items/powerup.dash.svg',
  slide: '/materials/items/powerup.slide.svg',
}).map(([cat, url]) =>
  renderIconToCanvas(url, '#ffffff', 90).then((tex) => {
    iconTextures[cat] = tex;
  })
);

// Wait for all icons to load (called once by PowerUpManager)
export function waitForIcons() {
  return Promise.all(iconPromises);
}

// ---------------------------------------------------------------------------
// PowerUpCoin — drops in, stands on edge, spins, bobs, wobbles
// ---------------------------------------------------------------------------

export function PowerUpCoin({
  spawnPosition = [0, 50, 0],
  category = 'speed',
  rarity = 'bronze',
  onCollected,
}) {
  const rigidRef = useRef();
  const standRef = useRef();
  const wobbleRef = useRef();
  const coinRef = useRef();
  const [phase, setPhase] = useState('dropping');
  const dropProgress = useRef(0);
  const floatPhase = useRef(Math.random() * Math.PI * 2);
  const targetY = 1.5;

  const catCfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.speed;
  const rarityCfg = RARITY_SCALE[rarity] ?? RARITY_SCALE.bronze;
  const iconTex = iconTextures[category] ?? iconTextures.speed;

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
      if (wobbleRef.current) {
        const t = state.clock.elapsedTime * 2.0 + floatPhase.current;
        wobbleRef.current.position.y = Math.sin(t) * 0.25;
        wobbleRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
        wobbleRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.6) * 0.1;
      }

      if (coinRef.current) {
        coinRef.current.rotation.z += delta * 2.5;
      }

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

  return (
    <RigidBody
      ref={rigidRef}
      type="fixed"
      position={spawnPosition}
      collisionGroups={COIN_COLLISION_GROUPS}
    >
      <group ref={standRef} rotation={[Math.PI / 2, 0, 0]}>
        <group ref={wobbleRef}>
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
              map={iconTex}
              emissiveMap={iconTex}
              emissive={new THREE.Color('#444444')}
              emissiveIntensity={0.3}
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
