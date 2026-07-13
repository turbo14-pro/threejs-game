import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../../store/useGameStore';

const _playerPos = new THREE.Vector3();
export const setLocalPlayerWorldPos = (v) => _playerPos.copy(v);

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
// SVG → emissive + bump textures
// ---------------------------------------------------------------------------

function renderIconTextures(svgUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const drawSize = ICON_SIZE * 0.75;

      // Emissive map: white icon on black — multiplied by emissive color in material
      const emissiveCanvas = document.createElement('canvas');
      emissiveCanvas.width = ICON_SIZE;
      emissiveCanvas.height = ICON_SIZE;
      const eCtx = emissiveCanvas.getContext('2d');
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
      eCtx.save();
      eCtx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      eCtx.rotate((ROTATION_DEG * Math.PI) / 180);
      eCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      eCtx.restore();

      const emissiveTex = new THREE.CanvasTexture(emissiveCanvas);
      emissiveTex.colorSpace = THREE.SRGBColorSpace;
      emissiveTex.needsUpdate = true;

      // Bump map: white icon on black with drop shadow
      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = ICON_SIZE;
      bumpCanvas.height = ICON_SIZE;
      const bCtx = bumpCanvas.getContext('2d');
      bCtx.fillStyle = '#000000';
      bCtx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
      bCtx.save();
      bCtx.shadowColor = 'rgba(0,0,0,0.8)';
      bCtx.shadowBlur = 8;
      bCtx.shadowOffsetX = 3;
      bCtx.shadowOffsetY = 3;
      bCtx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      bCtx.rotate((ROTATION_DEG * Math.PI) / 180);
      bCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      bCtx.restore();
      bCtx.save();
      bCtx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
      bCtx.rotate((ROTATION_DEG * Math.PI) / 180);
      bCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      bCtx.restore();

      const bumpTex = new THREE.CanvasTexture(bumpCanvas);
      bumpTex.colorSpace = THREE.NoColorSpace;
      bumpTex.needsUpdate = true;

      resolve({ emissiveTex, bumpTex });
    };
    img.src = svgUrl;
  });
}

// One emissive+bump pair per category (shared across rarities)
const iconData = {};
const iconPromises = Object.entries({
  jump:  '/materials/items/powerup.jump.svg',
  speed: '/materials/items/powerup.run.svg',
  dash:  '/materials/items/powerup.dash.svg',
  slide: '/materials/items/powerup.slide.svg',
}).map(([cat, url]) =>
  renderIconTextures(url).then((data) => { iconData[cat] = data; })
);

export function waitForIcons() {
  return Promise.all(iconPromises);
}

// ---------------------------------------------------------------------------
// PowerUpCoin
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
  const catCfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.speed;
  const icon = iconData[category] ?? iconData.speed;

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
      const y = spawnPosition[1] + (targetY - spawnPosition[1]) * (t * t);
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
      if (dx * dx + dy * dy + dz * dz < COLLECT_DISTANCE * COLLECT_DISTANCE) {
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
          <mesh ref={coinRef} scale={rarityCfg.scale} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
            <meshPhysicalMaterial
              color={rarityCfg.color}
              metalness={rarityCfg.metalness}
              roughness={rarityCfg.roughness}
              emissiveMap={icon.emissiveTex}
              emissive={catCfg.iconColor}
              emissiveIntensity={2}
              bumpMap={icon.bumpTex}
              bumpScale={2.4}
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
