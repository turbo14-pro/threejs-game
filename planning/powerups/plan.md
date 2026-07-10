# Power-Up Coin Token System — Implementation Plan

**Goal:** Add 16 power-up coin types (4 categories × 4 rarities) with animated drop, random spawning, hover/spin, and gameplay effects.
**Approach:** Rewrite `PowerUpCoin.jsx` (animated drop + distance pickup), add `PowerUpManager` for random spawning, refactor PlayerController jump/speed/dash/slide systems, add expiration timer, wire into Arena.
**Branch:** `feature/powerup-coins` (from `feature/authoritative-physics`)

## Scope
- **In:** 16 coin types, animated drop (y=50→y=1.5), random spawn positions (full table, exclude platforms+bridge), 8 coins max, 1-3 min interval, single-slot activation, duration timer, speed multiplier, jump count refactor, dash system (Q key, blue orb, invincibility), slide knockback scaling, rarity color tints, bloom via existing post-processing
- **Out:** Server-side sync, player visual effects (glow/trails), sound effects, multiple stacking slots, real Rapier physics for coins

---

## Testing & Linting Protocol

### Commands (Run After Every Task)
```bash
npm run lint      # Lint check — must pass
npm run build     # Build check — must succeed
npm run test      # Unit tests — must pass (if tests exist)
```

### Manual Test Commands
```bash
npm run dev       # Start dev server for manual testing
```

### Lint Failure = Blocker
If `npm run lint` fails:
1. Read the error message
2. Fix the file and line number
3. Re-run `npm run lint`
4. If still failing, check `planning/powerups/findings.md` for patterns
5. If persistent, add to task notes and continue to next task

### Build Failure = Blocker
If `npm run build` fails:
1. Read the error message
2. Fix the syntax/import error
3. Re-run `npm run build`
4. If still failing, revert the last change and try again

---

## Batch 1: Store Cleanup & Duration Config

### Objective
Remove dead power-up code and add centralized duration/effect configuration.

### Tasks
- [ ] Task 1.1: Delete dead code `collectPowerup`/`removePowerup` (lines 86-97 in `src/store/useGameStore.js`)
- [ ] Task 1.2: Add `POWERUP_DURATIONS` constant and `POWERUP_EFFECTS` config
- [ ] Task 1.3: Update `collectPowerUp` action to use `POWERUP_DURATIONS[rarity]`
- [ ] Task 1.4: Add `coinCount` state to store

### Code Reference
```js
// Add to top of useGameStore.js
export const POWERUP_DURATIONS = {
  bronze: 120,   // 2 min
  silver: 140,   // 2 min 20s
  gold: 160,     // 2 min 40s
  diamond: 180,  // 3 min
};

export const POWERUP_EFFECTS = {
  speed: { bronze: 2, silver: 3, gold: 4, diamond: 5 },      // multiplier
  jump:  { bronze: 3, silver: 4, gold: 5, diamond: 6 },      // total jumps
  dash:  { bronze: 0.3, silver: 0.5, gold: 0.7, diamond: 1.0 }, // seconds
  slide: { bronze: 1.5, silver: 2.0, gold: 2.5, diamond: 3.0 }, // BLAST_POWER multiplier
};
```

### Error Handling
- If `powerUp` state is corrupted (missing fields), `clearPowerUp()` and log warning
- If `POWERUP_DURATIONS[rarity]` is undefined, default to 120s

### Verification
- [ ] Dead code removed, no references to `collectPowerup` (lowercase) remain
- [ ] `collectPowerUp` uses duration from config, not param
- [ ] `coinCount` increments on spawn, decrements on collection

### Commit
`chore: cleanup dead power-up code, add duration/effect config`

---

## Batch 2: PowerUpCoin Rewrite (Animated Drop + Distance Pickup)

### Objective
Rewrite PowerUpCoin to use animated position drop (not Rapier physics) and distance-based pickup.

### Tasks
- [ ] Task 2.1: Rewrite `src/components/World/items/PowerUpCoin.jsx`
- [ ] Task 2.2: Add `spawnPosition` and `targetY` props
- [ ] Task 2.3: Implement drop animation with gravity curve
- [ ] Task 2.4: Add hover mode (spin + bob)
- [ ] Task 2.5: Add distance-based pickup
- [ ] Task 2.6: Add rarity color tints
- [ ] Task 2.7: Remove old props and sensor logic
- [ ] Task 2.8: Manual test

### Code Reference — Drop Animation
```jsx
// In useFrame, during 'dropping' phase:
dropProgress.current += delta * 0.67; // ~1.5s total
if (dropProgress.current >= 1) {
  dropProgress.current = 1;
  setPhase('hovering');
}
const t = dropProgress.current;
const eased = t * t; // Gravity acceleration curve
const y = spawnPosition[1] + (targetY - spawnPosition[1]) * eased;
rigidRef.current.setTranslation({ x: spawnPosition[0], y, z: spawnPosition[2] }, true);
```

### Code Reference — Distance Pickup
```jsx
// Shared player position (module-level)
const _playerPos = new THREE.Vector3();
export const setLocalPlayerWorldPos = (v) => _playerPos.copy(v);

// In useFrame, during 'hovering' phase:
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
```

### Code Reference — Rarity Tints
```jsx
const RARITY_SCALE = {
  bronze:  { scale: 1.0, emissiveMul: 0.5, metalness: 0.4, roughness: 0.6, emissiveColor: '#ffaa44' },
  silver:  { scale: 1.1, emissiveMul: 0.7, metalness: 0.7, roughness: 0.3, emissiveColor: '#aaddff' },
  gold:    { scale: 1.2, emissiveMul: 1.0, metalness: 0.8, roughness: 0.2, emissiveColor: '#ffcc00' },
  diamond: { scale: 1.3, emissiveMul: 1.3, metalness: 0.9, roughness: 0.1, emissiveColor: '#44ccff' },
};

// Material:
<meshStandardMaterial
  color={catCfg.color}
  emissive={rarityCfg.emissiveColor}
  emissiveIntensity={catCfg.emissiveIntensity * rarityCfg.emissiveMul}
  metalness={rarityCfg.metalness}
  roughness={rarityCfg.roughness}
/>
```

### Error Handling
- If `spawnPosition` is undefined, default to `[0, 50, 0]`
- If `targetY` is undefined, default to `1.5`
- If player position ref is stale (>1s since last update), skip pickup check

### Verification
- [ ] Coin appears at y=50, drops with gravity curve to y=1.5
- [ ] Coin spins on Y axis (2.5 rad/s) and bobs 0.25 units
- [ ] Diamond coins glow brightest, bronze glow faintest
- [ ] Player walks within 2.5 units → coin disappears instantly
- [ ] No Rapier sensor or collision events used

### Commit
`feat: power-up coin animated drop, hover, distance pickup, rarity tints`

---

## Batch 3: PowerUpManager (Random Spawning)

### Objective
Create spawn manager that places coins at random positions across the table.

### Tasks
- [ ] Task 3.1: Create `src/components/World/items/PowerUpManager.jsx`
- [ ] Task 3.2: Implement spawn timer (1-3 min random)
- [ ] Task 3.3: Define spawn zone with platform exclusion
- [ ] Task 3.4: Implement `spawnCoin()` with weighted random
- [ ] Task 3.5: Track active coins in store
- [ ] Task 3.6: Wire into Arena.jsx
- [ ] Task 3.7: Manual test

### Code Reference — Spawn Zone
```js
const TABLE_BOUNDS = { minX: -290, maxX: 290, minZ: -290, maxZ: 290 };
const EXCLUSION_ZONES = [
  { minX: -35, maxX: 35, minZ: -15, maxZ: 15 },      // Platform 1
  { minX: -35, maxX: 35, minZ: -60, maxZ: -30 },     // Platform 2
  { minX: -7.5, maxX: 7.5, minZ: -32.5, maxZ: -12.5 }, // Bridge
];

function getRandomSpawnPosition() {
  let x, z;
  do {
    x = TABLE_BOUNDS.minX + Math.random() * (TABLE_BOUNDS.maxX - TABLE_BOUNDS.minX);
    z = TABLE_BOUNDS.minZ + Math.random() * (TABLE_BOUNDS.maxZ - TABLE_BOUNDS.minZ);
  } while (EXCLUSION_ZONES.some(zone => 
    x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ
  ));
  return [x, 50, z]; // y=50 for drop animation
}
```

### Code Reference — Weighted Random
```js
const CATEGORIES = ['jump', 'speed', 'dash', 'slide']; // Equal 25% each
const RARITY_WEIGHTS = [
  { rarity: 'bronze', weight: 0.4 },
  { rarity: 'silver', weight: 0.3 },
  { rarity: 'gold', weight: 0.2 },
  { rarity: 'diamond', weight: 0.1 },
];

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
  return 'bronze'; // fallback
}
```

### Error Handling
- If `coinCount` exceeds 8, skip spawn
- If spawn position is too close to existing coin (<10 units), retry (max 5 attempts)
- If store is unavailable, log error and skip

### Verification
- [ ] Coins spawn at random positions across table
- [ ] No coins spawn on platforms or bridge
- [ ] Max 8 coins visible at once
- [ ] New coin spawns 1-3 min after previous collection
- [ ] Rarity weights: ~40% bronze, ~30% silver, ~20% gold, ~10% diamond

### Commit
`feat: power-up coin spawn manager with random positions`

---

## Batch 4: Expiration Timer & Speed/Slide Effects

### Objective
Add power-up expiration timer and apply speed/slide effects.

### Tasks
- [ ] Task 4.1: Add expiration check in `useFrame`
- [ ] Task 4.2: Add speed multiplier
- [ ] Task 4.3: Add slide knockback scaling
- [ ] Task 4.4: Clear power-up on death/respawn
- [ ] Task 4.5: Manual test

### Code Reference — Expiration Timer
```jsx
// In PlayerController.jsx, inside useFrame:
const powerUp = useGameStore.getState().powerUp;
if (powerUp && Date.now() >= powerUp.expiresAt) {
  useGameStore.getState().clearPowerUp();
}
```

### Code Reference — Speed Multiplier
```jsx
// Line 481 in PlayerController.jsx:
const powerUp = useGameStore.getState().powerUp;
const speedMultiplier = powerUp?.category === 'speed' 
  ? POWERUP_EFFECTS.speed[powerUp.rarity] 
  : 1;
const speed = isSliding ? 45 : (walkingInput ? 8 : 30) * speedMultiplier;
```

### Code Reference — Slide Knockback
```jsx
// In collision handler (~line 940):
const slideMultiplier = powerUp?.category === 'slide' 
  ? POWERUP_EFFECTS.slide[powerUp.rarity] 
  : 1;
const BLAST_POWER = 250 * slideMultiplier;
```

### Error Handling
- If `expiresAt` is NaN or invalid, clear power-up immediately
- If `powerUp.rarity` is undefined, default multiplier to 1

### Verification
- [ ] Speed boost applies: bronze=×2, silver=×3, gold=×4, diamond=×5
- [ ] Slide knockback scales: bronze=×1.5, silver=×2, gold=×2.5, diamond=×3
- [ ] Power-up expires after correct duration
- [ ] Power-up clears on death/respawn

### Commit
`feat: power-up speed multiplier, slide knockback scaling, expiration timer`

---

## Batch 5: Jump Count Refactor

### Objective
Replace boolean `hasDoubleJumped` with integer `jumpCount` to support 3-6 total jumps.

### Tasks
- [ ] Task 5.1: Replace `hasDoubleJumped` with `jumpCount`
- [ ] Task 5.2: Update jump logic for N jumps
- [ ] Task 5.3: Update jump state machine
- [ ] Task 5.4: Reset `jumpCount` on grounded
- [ ] Task 5.5: Manual test

### Code Reference
```jsx
// Replace:
const [hasDoubleJumped, setHasDoubleJumped] = useState(false);
// With:
const [jumpCount, setJumpCount] = useState(0);

// Calculate max jumps:
const powerUp = useGameStore.getState().powerUp;
const jumpBonus = powerUp?.category === 'jump' 
  ? POWERUP_EFFECTS.jump[powerUp.rarity] - 2 
  : 0; // base is 2 jumps
const maxJumps = 2 + jumpBonus;

// Double jump condition (line 543):
if (currentPhase === 'air' && jumpingInput && !prevJumpingInput.current && jumpCount < maxJumps - 1) {
  // ... apply jump impulse
  setJumpCount(jumpCount + 1);
  currentPhase = 'doublejump';
}

// Reset on grounded (line 496):
if (currentlyGrounded) {
  setJumpCount(0);
}
```

### Error Handling
- If `maxJumps` is NaN, default to 2
- If `jumpCount` somehow exceeds `maxJumps`, clamp to `maxJumps`

### Verification
- [ ] Base double jump (2 total) works without power-up
- [ ] Bronze = 3 total, Silver = 4, Gold = 5, Diamond = 6
- [ ] Jump count resets on landing
- [ ] No regression in jump timing or animation

### Commit
`feat: refactor jump system to support N jumps via jumpCount`

---

## Batch 6: Dash System (Q Key)

### Objective
Implement dash power-up: Q key activation, blue orb visual, invincibility, cooldown.

### Tasks
- [ ] Task 6.1: Add `dash` keyboard control (Q key)
- [ ] Task 6.2: Add dash state refs
- [ ] Task 6.3: Implement dash activation
- [ ] Task 6.4: Implement dash effect (blue orb + velocity)
- [ ] Task 6.5: Implement dash end + cooldown
- [ ] Task 6.6: Manual test

### Code Reference — Dash Activation
```jsx
// In PlayerController, add refs:
const isDashing = useRef(false);
const dashTimer = useRef(0);
const dashCooldown = useRef(0);

// In useFrame:
if (dashCooldown.current > 0) dashCooldown.current -= delta;

// On Q press:
const dashInput = useKeyboardControls((s) => s.dash);
if (dashInput && !prevDashInput.current && powerUp?.category === 'dash' && dashCooldown.current <= 0) {
  isDashing.current = true;
  dashTimer.current = POWERUP_EFFECTS.dash[powerUp.rarity];
  // Apply velocity burst in camera forward direction
  const cameraDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY.current);
  rigidBodyRef.current.setLinvel({
    x: cameraDir.x * 25,
    y: rigidBodyRef.current.linvel().y,
    z: cameraDir.z * 25
  }, true);
}
```

### Code Reference — Blue Orb Visual
```jsx
// During dash, hide player mesh and show blue sphere:
if (isDashing.current) {
  playerGroupRef.current.visible = false;
  // Render blue orb (add temporary mesh or toggle visibility)
} else {
  playerGroupRef.current.visible = true;
}
```

### Code Reference — Invincibility
```jsx
// In collision handler, skip knockback during dash:
if (isDashing.current) return; // Skip this collision
```

### Error Handling
- If `powerUp.category` is not 'dash', Q key does nothing
- If cooldown is active, Q key does nothing
- If dash timer expires, restore player mesh and start cooldown

### Verification
- [ ] Q key only works with dash power-up active
- [ ] Blue orb appears during dash
- [ ] Player is invincible during dash (no knockback)
- [ ] Dash ends after duration (bronze=0.3s, silver=0.5s, gold=0.7s, diamond=1.0s)
- [ ] 3s cooldown after dash ends

### Commit
`feat: dash power-up with blue orb visual and invincibility`

---

## Batch 7: HUD Power-Up Indicator

### Objective
Display active power-up with category, rarity, and countdown timer.

### Tasks
- [ ] Task 7.1: Create `src/components/UI/PowerUpHUD.jsx`
- [ ] Task 7.2: Position and fade animations
- [ ] Task 7.3: Wire into HUD.jsx
- [ ] Task 7.4: Manual test

### Code Reference
```jsx
// PowerUpHUD.jsx
export function PowerUpHUD() {
  const powerUp = useGameStore((s) => s.powerUp);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (powerUp) {
      setOpacity(1); // Fade in
    }
  }, [powerUp]);

  if (!powerUp) return null;

  const remaining = Math.max(0, powerUp.expiresAt - Date.now());
  const progress = remaining / (POWERUP_DURATIONS[powerUp.rarity] * 1000);

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, opacity, transition: 'opacity 0.3s' }}>
      <div style={{ color: CATEGORY_CONFIG[powerUp.category].color }}>
        {CATEGORY_CONFIG[powerUp.category].label}
      </div>
      <div style={{ color: RARITY_SCALE[powerUp.rarity].emissiveColor }}>
        {powerUp.rarity.toUpperCase()}
      </div>
      <div style={{ width: 100, height: 4, background: '#333', borderRadius: 2 }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: 'white', borderRadius: 2 }} />
      </div>
    </div>
  );
}
```

### Error Handling
- If `powerUp` is null, render nothing
- If `expiresAt` is invalid, show "???s" for timer

### Verification
- [ ] HUD appears top-right when power-up is active
- [ ] Shows category name and rarity badge
- [ ] Timer bar counts down
- [ ] Fades in on collect, fades out on expire

### Commit
`feat: power-up HUD indicator with timer`

---

## Batch 8: Polish & Integration Test

### Objective
Full integration testing and cleanup.

### Tasks
- [ ] Task 8.1: Test all 16 coin types
- [ ] Task 8.2: Test slot replacement
- [ ] Task 8.3: Test expiration
- [ ] Task 8.4: Test spawn system
- [ ] Task 8.5: Test dash system
- [ ] Task 8.6: Test jump system
- [ ] Task 8.7: Remove console.logs
- [ ] Task 8.8: Verify no regressions

### Test Matrix
| Coin Type | Effect | Expected Behavior |
|-----------|--------|-------------------|
| Bronze Speed | ×2 speed | Move 2x faster for 120s |
| Silver Speed | ×3 speed | Move 3x faster for 140s |
| Gold Speed | ×4 speed | Move 4x faster for 160s |
| Diamond Speed | ×5 speed | Move 5x faster for 180s |
| Bronze Jump | 3 jumps | Triple jump for 120s |
| Silver Jump | 4 jumps | Quadruple jump for 140s |
| Gold Jump | 5 jumps | Quintuple jump for 160s |
| Diamond Jump | 6 jumps | Sextuple jump for 180s |
| Bronze Dash | 0.3s dash | Quick dodge for 120s |
| Silver Dash | 0.5s dash | Medium dodge for 140s |
| Gold Dash | 0.7s dash | Long dodge for 160s |
| Diamond Dash | 1.0s dash | Longest dodge for 180s |
| Bronze Slide | ×1.5 knockback | Stronger slide for 120s |
| Silver Slide | ×2 knockback | Stronger slide for 140s |
| Gold Slide | ×2.5 knockback | Stronger slide for 160s |
| Diamond Slide | ×3 knockback | Stronger slide for 180s |

### Verification
- [ ] All 16 coin types work correctly
- [ ] Slot replacement works (new coin replaces old)
- [ ] Expiration clears power-up after duration
- [ ] Spawn system respects 8-coin cap
- [ ] Dash only works with dash power-up
- [ ] Jump count increases correctly
- [ ] No regressions in movement/jumping/sliding

### Commit
`chore: power-up system polish and integration verification`

---

## Files Reference

| File | Action | Batch |
|------|--------|-------|
| `src/store/useGameStore.js` | Modify | 1, 4 |
| `src/components/World/items/PowerUpCoin.jsx` | Rewrite | 2 |
| `src/components/World/items/PowerUpManager.jsx` | Create | 3 |
| `src/components/World/Arena.jsx` | Modify | 3 |
| `src/components/Player/PlayerController.jsx` | Modify | 4, 5, 6 |
| `src/App.jsx` | Modify | 6 |
| `src/components/UI/PowerUpHUD.jsx` | Create | 7 |
| `src/components/UI/HUD.jsx` | Modify | 7 |
