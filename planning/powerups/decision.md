# Decision: Power-Up Coin Token System

## What & Why
Add 16 power-up coin types (4 categories × 4 rarities) to the multiplayer arena game. Players collect floating coins for temporary buffs during battle. Coins spawn randomly across the map, drop in with animated physics, hover/spin above ground, and grant temporary buffs on collection. Only one power-up can be active at a time — collecting a new coin replaces the current effect.

## Who
All multiplayer players in the arena. Local-only effects (no server sync for power-up state).

---

## Constraints (Hard Rules)

| # | Constraint | Value | Rationale |
|---|-----------|-------|-----------|
| C1 | Active slot limit | 1 (single) | Prevents OP combos, simpler balance |
| C2 | Max coins on map | 8 | Controlled scarcity without frustration |
| C3 | Drop mechanism | Animated (type="fixed") | Avoids Rapier sensor/physics conflict |
| C4 | Spawn zone | Full 600×600 table | Maximum variety |
| C5 | Exclusion zones | Platforms + bridge | Prevents unreachable coins |
| C6 | Drop height | y=50 | Dramatic visual, visible from distance |
| C7 | Hover height | y=1.5 | Clean float above table surface |
| C8 | Duration ladder | 120/140/160/180s | Strictly increasing +20s per rarity |
| C9 | Spawn interval | 1-3 minutes | Faster pacing than 3-7 min |
| C10 | Effect scope | Local-only | No network sync needed |
| C11 | Movement safety | No regressions | Must not break existing controls |
| C12 | Dash availability | Dash power-up only | Q key does nothing without dash coin |
| C13 | Bloom | Existing post-processing | No custom shaders needed |
| C14 | Rarity visuals | Color tint per rarity | Emissive color shift, not just scale |

---

## Non-Goals (Explicitly Out of Scope)

1. Server-side power-up authority
2. Player visual effects (glowing model, trails) during power-up
3. Sound effects for collection or power-up active state
4. Multiple stacking power-up slots
5. Power-up trading or sharing between players
6. Real Rapier physics for coins (using animated drop instead)

---

## Assumptions (Marked ⚠️ if Uncertain)

| # | Assumption | Confidence |
|---|-----------|------------|
| A1 | Dash direction = camera forward | ⚠️ Medium — could be movement direction |
| A2 | Collecting dash coin replaces any active power-up | High — single slot design |
| A3 | Categories equally likely (25% each) | High — user confirmed |
| A4 | Rarity weights: 40/30/20/10 | High — user confirmed |
| A5 | Instanced meshes only if >8 coins | High — current cap is 8 |
| A6 | Coins always available (no phases) | High — user confirmed |

---

## Decision Log

### Core Design Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | 16 coin types (4×4) | 4-type system | Full rarity depth creates progression feel |
| 2 | Duration: 120/140/160/180s | Flat 120s | Higher rarity = longer feels rewarding |
| 3 | Single active slot | Multiple stacking | Simpler balance, no OP combos |
| 4 | Random spawn positions | Hardcoded positions | Variety, unpredictability |
| 5 | 8 coins max | 5 or unlimited | More opportunities, still controlled |
| 6 | Local-only effects | Server-authoritative | Simpler, no network changes |

### Technical Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 7 | Animated drop (type="fixed") | Real Rapier physics | Avoids sensor/physics conflict |
| 8 | Distance-based pickup | Rapier sensor collision | Works with type="fixed" |
| 9 | 1-3 min spawn interval | 3-7 minutes | Faster pacing |
| 10 | Exclude platforms+bridge | No exclusion | Prevents unreachable coins |
| 11 | y=50 drop → y=1.5 hover | y=67 drop | Dramatic visual, clean hover |
| 12 | Bloom via existing pipeline | Custom glow shader | Already built, no extra work |

### Gameplay Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 13 | Refactor hasDoubleJumped → jumpCount | Keep boolean | Supports 3-6 jumps cleanly |
| 14 | Dash uses Q key | Double-tap direction | Explicit, avoids accidents |
| 15 | Blue orb during dash | Player model stays | Clear visual feedback |
| 16 | 3s dash cooldown | No cooldown | Prevents spam |
| 17 | Dash duration scales | Fixed duration | Rarity matters |
| 18 | Coins always available | BATTLE-only | Continuous gameplay |

### Visual Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 19 | Rarity color tints | Same emissive all | Visual rarity distinction |
| 20 | Instant disappear | Scale-out animation | Instant feedback |
| 21 | Spin + bob while hovering | Spin only | Gentle floating feel |
| 22 | ~1.5s drop with gravity curve | Instant or slow | Snappy but visible |
| 23 | Items folder: items/ | Obsticles/ | Cleaner organization |
| 24 | Weighted rarity: 40/30/20/10 | Equal 25% | Common items more frequent |

---

## Approaches Considered

### Recommended: Animated Drop + Distance Pickup
PowerUpCoin is `type="fixed"` with position animated in `useFrame` (gravity curve). Pickup triggers by checking player distance each frame — no Rapier collision events needed.

**Why:** Avoids the sensor/physics conflict entirely. Simple, reliable, performant.

**Trade-off:** Less "real" physics feel, but visually identical.

### Alternative: Real Rapier Physics (type="dynamic")
Coin falls with real gravity, then switches to `type="fixed"` when settled via `setBodyType()`.

**Trade-off:** More realistic but requires managing body type transitions, collision groups, and sensor toggle. Complex for minimal visual benefit.

**Rejected because:** Rapier's `setBodyType()` can be unreliable, and the sensor/physics conflict makes clean pickup difficult.

### Alternative: Server-Authoritative Spawning
Server tracks coin state, broadcasts spawn/despawn events to all clients.

**Trade-off:** More consistent multiplayer experience but requires new network protocol, server state, and conflict resolution.

**Rejected because:** Out of scope for initial implementation. Local-only is simpler and sufficient.

---

## Architecture

```
PowerUpManager (spawns coins, tracks count, random positions)
  └─ PowerUpCoin × 8 max (animated drop + hover + distance pickup)
       └─ on collect → store.collectPowerUp(category, rarity)
            └─ PlayerController reads powerUp, applies effects
                 └─ Expiration timer → store.clearPowerUp()
```

## State Flow

1. PowerUpManager spawns coin → coin appears at y=50, animated drop to y=1.5 over ~1.5s
2. Coin hovers: spins on Y axis, bobs up/down 0.25 units
3. Player walks within 2.5 units → `collectPowerUp()` called, coin disappears instantly
4. Store sets `powerUp: { category, rarity, expiresAt }`
5. PlayerController reads `powerUp` each frame:
   - Speed: multiply movement speed by rarity multiplier
   - Jump: allow N total jumps based on rarity
   - Slide: multiply BLAST_POWER by rarity multiplier
   - Dash: enable Q key, apply velocity burst + invincibility
6. `useFrame` checks `expiresAt` → calls `clearPowerUp()` when expired
7. New coin spawns after 1-3 minute random interval (if < 8 on map)
