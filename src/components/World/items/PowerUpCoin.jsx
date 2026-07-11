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
  jump:  { iconColor: '#00ff88', label: 'Jump' },
  speed: { iconColor: '#ff8800', label: 'Speed' },
  dash:  { iconColor: '#4488ff', label: 'Dash' },
  slide: { iconColor: '#ff44ff', label: 'Slide' },
};

const RARITY_CONFIG = {
  bronze:  { color: '#8B5E3C', scale: 1.0, metalness: 0.95, roughness: 0.08 },
  silver:  { color: '#C0C0C0', scale: 1.1, metalness: 0.95, roughness: 0.05 },
  gold:    { color: '#FFD700', scale: 1.2, metalness: 0.98, roughness: 0.03 },
  diamond: { color: '#B9F2FF', scale: 1.3, metalness: 1.0,  roughness: 0.01 },
};

const COLLECT_DISTANCE = 2.5;
const COIN_COLLISION_GROUPS = 0x00000002;

const ICON_SIZE = 512;
const ROTATION_DEG = -90;

// ---------------------------------------------------------------------------
// SVG → three canvas textures: colorMap + emissiveMap + bumpMap
// ---------------------------------------------------------------------------

function renderIconTextures(svgUrl, rarityColor, iconColor) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const drawSize = ICON_SIZE * 0.75;

      // ---- Color map: rarity color as solid background ---------------------
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = ICON_SIZE;
      colorCanvas.height = ICON_SIZE;
      const cCtx = colorCanvas.getContext('2d');
      cCtx.fillStyle = rarityColor;
      cCtx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

      const colorTex = new THREE.CanvasTexture(colorCanvas);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      colorTex.needsUpdate = true;

      // ---- Emissive map: icon in category color on black (for bloom) ------
      const emissiveCanvas = document.createElement('canvas');
      emissiveCanvas.width = ICON_SIZE;
      emissiveCanvas.height = ICON_SIZE;
      const eCtx = emissiveCanvas.getContext('2d');

      // Black background (no glow)
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

      // Draw icon in category color (glows with bloom)
      eCtx.save();
      eCtx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      eCtx.rotate((ROTATION_DEG * Math.PI) / 180);
      eCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      eCtx.restore();

      const emissiveTex = new THREE.CanvasTexture(emissiveCanvas);
      emissiveTex.colorSpace = THREE.SRGBColorSpace;
      emissiveTex.needsUpdate = true;

      // ---- Bump map: white icon on black background ------------------------
      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = ICON_SIZE;
      bumpCanvas.height = ICON_SIZE;
      const bCtx = bumpCanvas.getContext('2d');

      bCtx.fillStyle = '#000000';
      bCtx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

      // Drop shadow for depth
      bCtx.save();
      bCtx.shadowColor = 'rgba(0,0,0,0.8)';
      bCtx.shadowBlur = 8;
      bCtx.shadowOffsetX = 3;
      bCtx.shadowOffsetY = 3;
      bCtx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      bCtx.rotate((ROTATION_DEG * Math.PI) / 180);
      bCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      bCtx.restore();

      // Sharp icon on top
      bCtx.save();
      bCtx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      bCtx.rotate((ROTATION_DEG * Math.PI) / 180);
      bCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      bCtx.restore();

      const bumpTex = new THREE.CanvasTexture(bumpCanvas);
      bumpTex.colorSpace = THREE.NoColorSpace;
      bumpTex.needsUpdate = true;

      resolve({ colorTex, emissiveTex, bumpTex });
    };
    img.src = svgUrl;
  });
}

// Pre-built icon textures: keyed by category, but each category needs all 4 rarities
// Since rarity is a prop, we build a combined key: `${category}_${rarity}`
const iconData = {};
const svgMap = {
  jump:  '/materials/items/powerup.jump.svg',
  speed: '/materials/items/powerup.run.svg',
  dash:  '/materials/items/powerup.dash.svg',
  slide: '/materials/items/powerup.slide.svg',
};

const iconPromises = [];
for (const [cat, url] of Object.entries(svgMap)) {
  for (const [rarity, rarityCfg] of Object.entries(RARITY_CONFIG)) {
    const key = `${cat}_${rarity}`;
    const p = renderIconTextures(url, rarityCfg.color, CATEGORY_CONFIG[cat].iconColor).then((data) => {
      iconData[key] = data;
    });
    iconPromises.push(p);
  }
}

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

  const rarityCfg = RARITY_CONFIG[rarity] ?? RARITY_CONFIG.bronze;
  const icon = iconData[`${category}_${rarity}`] ?? iconData[`${category}_bronze`];

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

  const emissiveColor = CATEGORY_CONFIG[category]?.iconColor ?? '#ffffff';

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
              map={icon.colorTex}
              emissiveMap={icon.emissiveTex}
              emissive={emissiveColor}
              emissiveIntensity={1.5}
              bumpMap={icon.bumpTex}
              bumpScale={2.4}
              metalness={rarityCfg.metalness}
              roughness={rarityCfg.roughness}
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
