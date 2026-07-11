import { useEffect, useRef, useState, useCallback } from 'react';
import { PowerUpCoin, waitForIcons } from './PowerUpCoin.jsx';
import { useGameStore } from '../../../store/useGameStore';

// ---------------------------------------------------------------------------
// Spawn zone config
// ---------------------------------------------------------------------------

const TABLE_BOUNDS = { minX: -290, maxX: 290, minZ: -290, maxZ: 290 };
const EXCLUSION_ZONES = [
  { minX: -35, maxX: 35, minZ: -15, maxZ: 15 },         // Platform 1
  { minX: -35, maxX: 35, minZ: -60, maxZ: -30 },        // Platform 2
  { minX: -7.5, maxX: 7.5, minZ: -32.5, maxZ: -12.5 },  // Bridge
];

const MAX_COINS = 8;
const MIN_SPAWN_INTERVAL = 60;
const MAX_SPAWN_INTERVAL = 180;
const MIN_DISTANCE_BETWEEN = 10;

// ---------------------------------------------------------------------------
// Category + rarity config
// ---------------------------------------------------------------------------

const CATEGORIES = ['jump', 'speed', 'dash', 'slide'];
const RARITY_WEIGHTS = [
  { rarity: 'bronze',  weight: 0.4 },
  { rarity: 'silver',  weight: 0.3 },
  { rarity: 'gold',    weight: 0.2 },
  { rarity: 'diamond', weight: 0.1 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRandomSpawnPosition(existingCoins) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let x, z;
    let insideExclusion;
    do {
      x = TABLE_BOUNDS.minX + Math.random() * (TABLE_BOUNDS.maxX - TABLE_BOUNDS.minX);
      z = TABLE_BOUNDS.minZ + Math.random() * (TABLE_BOUNDS.maxZ - TABLE_BOUNDS.minZ);
      insideExclusion = EXCLUSION_ZONES.some(
        (zone) => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ,
      );
    } while (insideExclusion);

    const tooClose = existingCoins.some((coin) => {
      const dx = coin.position[0] - x;
      const dz = coin.position[2] - z;
      return Math.sqrt(dx * dx + dz * dz) < MIN_DISTANCE_BETWEEN;
    });
    if (!tooClose) return [x, 50, z];
  }
  const x = TABLE_BOUNDS.minX + Math.random() * (TABLE_BOUNDS.maxX - TABLE_BOUNDS.minX);
  const z = TABLE_BOUNDS.minZ + Math.random() * (TABLE_BOUNDS.maxZ - TABLE_BOUNDS.minZ);
  return [x, 50, z];
}

function getRandomCategory() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function getRandomRarity() {
  const r = Math.random();
  let cumulative = 0;
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    cumulative += weight;
    if (r <= cumulative) return rarity;
  }
  return 'bronze';
}

function randomSpawnInterval() {
  return MIN_SPAWN_INTERVAL + Math.random() * (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
}

// ---------------------------------------------------------------------------
// PowerUpManager — spawns coins at random intervals + positions
// ---------------------------------------------------------------------------

export function PowerUpManager() {
  const [coins, setCoins] = useState([]);
  const [iconsReady, setIconsReady] = useState(false);
  const elapsedRef = useRef(0);
  const nextSpawnRef = useRef(randomSpawnInterval());
  const idCounterRef = useRef(0);

  // Wait for high-res icon textures to render
  useEffect(() => {
    waitForIcons().then(() => setIconsReady(true));
  }, []);

  const spawnCoin = useCallback(() => {
    const state = useGameStore.getState();
    if (state.coinCount >= MAX_COINS) return;

    const id = ++idCounterRef.current;
    const position = getRandomSpawnPosition(coins);
    const category = getRandomCategory();
    const rarity = getRandomRarity();

    setCoins((prev) => [...prev, { id, position, category, rarity, alive: true }]);
    useGameStore.getState().incrementCoinCount();
  }, [coins]);

  useEffect(() => {
    const interval = setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current >= nextSpawnRef.current) {
        spawnCoin();
        elapsedRef.current = 0;
        nextSpawnRef.current = randomSpawnInterval();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [spawnCoin]);

  useEffect(() => {
    const t = setTimeout(spawnCoin, 1000);
    return () => clearTimeout(t);
  }, [spawnCoin]);

  const handleCollected = useCallback((id) => {
    setCoins((prev) => prev.map((c) => (c.id === id ? { ...c, alive: false } : c)));
    useGameStore.getState().decrementCoinCount();
  }, []);

  if (!iconsReady) return null;

  return (
    <group>
      {coins
        .filter((c) => c.alive)
        .map((coin) => (
          <PowerUpCoin
            key={coin.id}
            spawnPosition={coin.position}
            category={coin.category}
            rarity={coin.rarity}
            onCollected={() => handleCollected(coin.id)}
          />
        ))}
    </group>
  );
}
