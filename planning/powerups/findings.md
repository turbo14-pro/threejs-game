# Findings: Power-Up Coin System Architecture Research

## Date: 2026-07-10

---

## Executive Summary

**Key Finding:** The existing `PowerUpCoin.jsx` needs a complete rewrite to support animated drop and distance-based pickup. The store has dead code that must be removed. PlayerController has hardcoded values that need power-up injection points.

**Critical Path:**
1. Delete dead code in store (lines 86-97)
2. Rewrite PowerUpCoin with animated drop + distance pickup
3. Create PowerUpManager for random spawning
4. Add power-up effect injection points in PlayerController

---

## Existing Power-Up Code

### PowerUpCoin.jsx (src/components/World/items/PowerUpCoin.jsx — 107 lines)

**Status:** Component exists but needs rewrite

| Aspect | Current | Required |
|--------|---------|----------|
| Location | `items/` ✅ | `items/` ✅ |
| Body type | `type="fixed"` ✅ | `type="fixed"` ✅ |
| Collision | Sensor + `onCollisionEnter` | Distance-based (no Rapier) |
| Drop | None | Animated from y=50 to y=1.5 |
| Pickup | Rapier collision event | Distance check (< 2.5 units) |
| Rarity visual | Scale + metalness only | + emissive color tint |
| Duration | `durationSeconds` prop | Store config (120-180s) |

**Must Remove:**
- `sensor` prop
- `onCollisionEnter` handler
- `durationSeconds` prop
- `colliders="ball"` (not needed for distance pickup)

**Must Add:**
- `spawnPosition` prop (default `[0, 50, 0]`)
- `targetY` prop (default `1.5`)
- Drop animation in `useFrame` (gravity curve)
- Hover mode (spin + bob)
- Distance-based pickup check
- Rarity `emissiveColor` to `RARITY_SCALE`

### Store Power-Up State (src/store/useGameStore.js)

**Working (keep):**
- `powerUp: null` (line 83) — stores `{ category, rarity, expiresAt }`
- `collectPowerUp(category, rarity, durationSeconds=4)` (line 242)
- `clearPowerUp()` (line 250)

**Dead code (delete):**
- `collectPowerup` (lowercase, lines 86-93) — references undefined `getPowerUpDuration()`
- `removePowerup` (lowercase, lines 95-97) — duplicates `clearPowerUp()`

**Missing (add):**
- `POWERUP_DURATIONS` config constant
- `POWERUP_EFFECTS` config constant
- `coinCount` state for spawn tracking
- Expiration logic (check `expiresAt` in useFrame)

---

## PlayerController Architecture

### Injection Points Needed

| Line | Current Code | Power-Up Modification |
|------|-------------|----------------------|
| 481 | `const speed = isSliding ? 45 : (walkingInput ? 8 : 30)` | Multiply by `speedMultiplier` when speed power-up active |
| 496 | `setHasDoubleJumped(false)` | Replace with `setJumpCount(0)` |
| 543 | `if (currentPhase === 'air' && jumpingInput && !prevJumpingInput.current && !hasDoubleJumped)` | Change to `jumpCount < maxJumps - 1` |
| ~940 | `const BLAST_POWER = 250` | Multiply by `slideMultiplier` when slide power-up active |
| Collision handler | No invincibility check | Add `if (isDashing.current) return` |

### Jump Refactor Details

**Current:**
```jsx
const [hasDoubleJumped, setHasDoubleJumped] = useState(false);
// ...
if (currentlyGrounded) setHasDoubleJumped(false);
// ...
if (!hasDoubleJumped) { /* double jump */ }
```

**Target:**
```jsx
const [jumpCount, setJumpCount] = useState(0);
// ...
if (currentlyGrounded) setJumpCount(0);
// ...
const maxJumps = 2 + jumpBonus; // jumpBonus from power-up
if (jumpCount < maxJumps - 1) { /* air jump */ }
```

### Dash System Details

**New state needed:**
```jsx
const isDashing = useRef(false);
const dashTimer = useRef(0);
const dashCooldown = useRef(0);
```

**Activation:**
```jsx
// Q press + dash power-up + no cooldown
if (dashInput && powerUp?.category === 'dash' && dashCooldown.current <= 0) {
  isDashing.current = true;
  dashTimer.current = POWERUP_EFFECTS.dash[powerUp.rarity];
  // Apply velocity burst in camera direction
}
```

**Invincibility:**
```jsx
// In collision handler:
if (isDashing.current) return; // Skip knockback
```

---

## Arena Layout

### Spawn Zone
- **Table:** 600×600 units centered at origin
- **Surface:** y=0 (table at y=-1, height 2)
- **Valid spawn:** x: -290 to 290, z: -290 to 290

### Exclusion Zones (No Coins)
| Zone | Position | Size | Bounds |
|------|----------|------|--------|
| Platform 1 | [0, 100, 0] | 70×30 | x: ±35, z: ±15 |
| Platform 2 | [0, 100, -45] | 70×30 | x: ±35, z: -60 to -30 |
| Bridge | [0, 100, -22.5] | 15×20 | x: ±7.5, z: -32.5 to -12.5 |

### Existing Sensor Patterns (Reference)
- **SkinPodium:** `RigidBody type="fixed" sensor onIntersectionEnter={...}`
- **WeaponPodium:** Same pattern
- **StartButton:** Same pattern

---

## Collision Group System

| Component | `collisionGroups` | Notes |
|-----------|------------------|-------|
| Player | `0x0002FFFF` | Group 0x0002, collides with all |
| Remote Player | `0x0002FFFF` | Same as local player |
| Platform Boundaries | `0x0002FFFF` | Same as players |
| Cereal Box | `0x0001FFFF` | Group 0x0001, collides with all |
| Tin Can | `0x0001FFFF` | Group 0x0001, collides with all |
| PowerUpCoin | N/A | Not using Rapier collision |
| Skin/Weapon Podiums | N/A | Using sensor |

**Note:** PowerUpCoin will NOT use Rapier collision groups since it uses distance-based pickup.

---

## Networking Architecture

**Power-up state is NOT synced** — this is by design (local-only effects).

### Events (for reference)
- `'pos'` — position/rotation/animation at ~10Hz
- `'input'` — input state at ~30Hz
- `'impact'` — slide collision data

---

## Key Patterns

### Pattern: Animated Position Drop
```jsx
const [phase, setPhase] = useState('dropping');
const dropProgress = useRef(0);

useFrame((state, delta) => {
  if (phase === 'dropping') {
    dropProgress.current += delta * 0.67; // ~1.5s total
    const t = Math.min(dropProgress.current, 1);
    const eased = t * t; // Gravity curve
    const y = startY + (targetY - startY) * eased;
    rigidRef.current.setTranslation({ x, y, z }, true);
    if (t >= 1) setPhase('hovering');
  }
});
```

### Pattern: Distance-Based Pickup
```jsx
const _playerPos = new THREE.Vector3();
export const setLocalPlayerWorldPos = (v) => _playerPos.copy(v);

useFrame(() => {
  if (phase !== 'hovering') return;
  const coinPos = rigidRef.current.translation();
  const dx = coinPos.x - _playerPos.x;
  const dy = coinPos.y - _playerPos.y;
  const dz = coinPos.z - _playerPos.z;
  if (dx*dx + dy*dy + dz*dz < COLLECT_DISTANCE * COLLECT_DISTANCE) {
    collect();
  }
});
```

### Pattern: Random Position with Exclusion
```jsx
function getRandomSpawnPosition() {
  let x, z;
  for (let attempt = 0; attempt < 5; attempt++) {
    x = -290 + Math.random() * 580;
    z = -290 + Math.random() * 580;
    if (!isInExclusionZone(x, z)) return [x, 50, z];
  }
  return [0, 50, 0]; // fallback
}
```

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Jump refactor breaks double jump | High | Medium | Test base double jump after every change |
| Dash invincibility not working | Medium | Low | Add explicit `isDashing` check in collision handler |
| Spawn positions overlap | Low | Low | Exclusion zone math + retry logic |
| Duration timer drift | Low | Very low | Use `Date.now()` comparison |
| Power-up persists after death | Medium | Medium | Clear in `respawnToLobby()` |
| Distance pickup misses fast players | Low | Very low | 2.5 unit threshold is generous |
| Animated drop looks unnatural | Low | Low | Gravity curve provides realism |
| Player position ref stale | Medium | Low | Update every frame in PlayerController |

---

## Integration Checklist

- [ ] Store: dead code removed, duration config added
- [ ] PowerUpCoin: animated drop, distance pickup, rarity tints
- [ ] PowerUpManager: random positions, 1-3 min interval, 8 max
- [ ] PlayerController: speed multiplier, jump refactor, dash system, slide scaling
- [ ] Arena: PowerUpManager mounted, import path updated
- [ ] App.jsx: Q key added to keyboard controls
- [ ] HUD: PowerUpHUD component created and wired in
