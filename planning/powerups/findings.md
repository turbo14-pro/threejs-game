# Findings: Power-Up Multiplier System Extension

## Research Date: 2026-07-11 (Updated: 2026-07-11)

---

## Existing System Overview

### 1. Power-Up Coin System (`src/components/World/items/PowerUpCoin.jsx`)
- **Categories**: jump, speed, dash, slide
- **Rarities**: bronze, silver, gold, diamond
- **Detection**: Distance-based (2.5m radius) from shared `_playerPos`
- **Visuals**: SVG-based icons rendered to canvas textures (colorMap, emissiveMap, bumpMap)
- **Animations**: Drop-in → hover with wobble + spin

### 2. Power-Up Effects Config (`src/store/useGameStore.js`)
- **`POWERUP_EFFECTS`** — single-value-per-rarity map:
  - `speed`: bronze=2, silver=3, gold=4, diamond=5 (movement speed multiplier)
  - `jump`: bronze=3, silver=4, gold=5, diamond=6 (total jumps)
  - `dash`: bronze=0.5, silver=0.8, gold=1.0, diamond=1.3 (dash duration seconds)
  - `slide`: bronze=1.5, silver=2.0, gold=2.5, diamond=3.0 (blast power multiplier)
- **`POWERUP_DURATIONS`**: bronze=120s, silver=140s, gold=160s, diamond=180s
- **`collectPowerUp`**: Called from PowerUpCoin, sets single `powerUp` state: `{ category, rarity, expiresAt }`
- **`clearPowerUp`**: Nullifies on expiration (checked in PlayerController useFrame)

### 3. Where Multipliers Are Used (PlayerController.jsx)

| Category | Usage | Formula |
|----------|-------|---------|
| **speed** | Movement speed (line 559) | `speed = isSliding ? 45 * speedMultiplier : (walkingInput ? 8 : 30) * speedMultiplier` |
| **jump** | Max jumps (line 573-574) | `maxJumps = 2 + (POWERUP_EFFECTS.jump[rarity] - 2)` |
| **dash** | Dash duration (line 421) | `dashTimer.current = POWERUP_EFFECTS.dash[rarity] \|\| 0.3` |
| **slide** | Blast power (line 1024-1028) | `BLAST_POWER = 250 * slideMultiplier` where slideMultiplier comes from `POWERUP_EFFECTS.slide[rarity]` |

### 4. Knockback Mechanics
- **Attacker (slide impact)**: `BLAST_POWER = 250 * slideMultiplier` (line 1028)
- **Victim (speed powerup)**: `hasSpeedPowerUp ? 4 : 45` upward pop + `0.03` slide multiplier for speed (line 1027, 1029)
- **External knockback** (line 302-324): `forceMultiplier = knockbackForce / 250` → vertical pop `55 * normalizedForce`
- **Knockback decay**: `externalForce.current.multiplyScalar(Math.max(0, 1 - 8 * delta))`
- **Victim-side (line 1078)**: `triggerKnockback(finalDir, 3)` with fixed force of 3

### 5. Radial Blur (`RadialBlurEffect.jsx`)
- Currently **binary on/off** (setDashBlur(true/false))
- Target intensity: `0.8` when active, `0.0` when inactive
- Lerp speed: `0.15` per frame
- Only triggered by **dash** currently

### 6. Shockwave / Impact Effects
- **ShockwaveEffect**: Uses `@react-three/postprocessing` ShockWave component
  - Duration: 0.8s, size: `life * 100.0`, opacity: `1.0 - life`
  - Pool of 3, triggered by `addShockwave(position)` in store
  - Currently triggered on **slide impact** (line 1041)
  - **Note**: User reports this never worked properly

### 7. Post-Processing Pipeline (`Effects.jsx`)
- Order: FXAA → SSAO → Shockwave × 3 → RadialBlur → Bloom → Vignette → Grain → SMAA → ToneMapping

---

## Hardcoded Baseline Values (to be extracted into config)

| Parameter | Current Value | Location |
|-----------|--------------|----------|
| **Walk speed** | 8 | PlayerController line 559 |
| **Sprint speed** | 30 | PlayerController line 559 |
| **Slide speed** | 45 | PlayerController line 559 |
| **Jump velocity (ground)** | 38 | PlayerController line 613 |
| **Jump velocity (air/double)** | 35 | PlayerController line 629 |
| **Slide burst multiplier** | 1.5 | PlayerController line 534 |
| **Base BLAST_POWER** | 250 | PlayerController line 1028 |
| **Base UPWARD_POP (normal)** | 45 | PlayerController line 1029 |
| **Speed-up UPWARD_POP** | 4 | PlayerController line 1029 |
| **Victim triggerKnockback force** | 3 | PlayerController line 1078 |
| **External knockback base force** | 250 | useGameStore line 134 |
| **Vertical pop (external)** | 55 * normalizedForce | PlayerController line 316 |
| **Slide duration** | 0.6 | PlayerController line 532 |
| **Dash cooldown** | 3 | PlayerController line 452 |
| **Dash duration (no powerup)** | 0.3 | PlayerController line 449 |
| **Max jumps (no powerup)** | 2 | PlayerController line 575 |

---

## New Requirements

### 1. Central Player Config File (`src/config/playerConfig.js`)
- Move all baseline values into a single config
- Include power-up multiplier tables
- Include baseline knockback values (player-to-player, player-to-physics-objects)

### 2. Multiplier Table (instead of single value per rarity)
Each category gets multiple named multipliers:

| Category | Multipliers |
|----------|-------------|
| **jump** | `jumpCount` — extra jumps |
| **speed** | `speedMultiplier` + `knockbackReduction` (reduce *dealt* knockback to compensate for higher speed) |
| **dash** | `dashDuration` + `radialBlurIntensity` |
| **slide** | `blastPowerMultiplier` + `knockbackMultiplier` |

### 3. Radial Blur as Power-Up Scaled Effect
- No longer binary on/off
- Each category specifies its own `radialBlurIntensity`
- PostEffects system controls activation with multiplier-based scaling

### 4. Post Effects Activation System
- Controls post effects triggered by player actions
- Parameters: baseline → bronze → silver → gold → diamond
- Effects: ripple/impact (shockwave), speed radial blur, etc.

### 5. Fix ShockwaveEffect
- Investigate why it doesn't render properly
- Ensure it accepts a multiplier for strength

### 6. Speed → Knockback Compensation
- When speed power-up is active, knockback *dealt* is reduced inversely to speed
- Formula: `effectiveKnockback = baseKnockback / speedMultiplier` (or knockbackReduction multiplier from config)