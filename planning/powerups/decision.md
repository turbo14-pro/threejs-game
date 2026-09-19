# Decision: Power-Up Multiplier System Extension

## What & Why
Extend the power-up coin system with a multiplier table supporting multiple named multipliers per category, a central player config file, a post-effects activation system, fix the shockwave effect, and add speed knockback compensation.

## Who
Game players (multiplayer arena)

## Constraints
- Must NOT create god files — config is centralized but consumers import specific values
- Must preserve all existing behavior until explicitly changed
- ShockwaveEffect must be fixed (it never worked properly)
- All hardcoded baseline values must be extracted into config

## Non-Goals
- Not changing the coin pickup/detection logic
- Not changing the PowerUpCoin visual or animation system
- Not modifying the network/multiplayer protocol
- Not adding new power-up categories (keep jump/speed/dash/slide)

## Assumptions
- ⚠️ ShockwaveEffect uses `@react-three/postprocessing` ShockWave component correctly — issue may be with parameters or pipeline ordering
- RadialBlurEffect can be extended with multiplier support without breaking existing dash behavior

## Decision Log
| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | Create `src/config/playerConfig.js` | Keep values in PlayerController | Centralized config avoids scattered magic numbers |
| 2 | Multiplier table: each category has object with named multipliers | Flat single values | Supports multiple effects per coin (e.g. speed + knockbackReduction) |
| 3 | PostEffects system as separate module | Inline in PlayerController | Clean separation, testable, follows existing architecture |
| 4 | ShockwaveEffect: fix parameters + add intensity multiplier | Rewrite from scratch | Existing component is correct pattern, just needs correct tuning |
| 5 | Speed knockbackReduction reduces *dealt* knockback | Reduce *received* knockback | Knockback is based on velocity — higher speed = more knockback, so compensation reduces dealt knockback |
| 6 | Use existing POWERUP_EFFECTS values as base for multiplier table | New magic numbers | Preserves existing game balance, just restructures |
| 7 | Radial blur: each category specifies intensity (0-1) | Keep binary | Allows speed to have small blur, dash to have big blur |

## Approaches Considered

### Recommended: Config + Multiplier Table + PostEffects System
- Single `src/config/playerConfig.js` with all baseline values
- `POWERUP_EFFECTS` becomes nested multiplier objects
- PostEffects activation module reads current power-up state and drives effect intensity
- PlayerController imports config values instead of hardcoding

### Alternative: Keep everything inline
- Simple to implement but creates maintenance burden and scattered magic numbers
- Rejected because user specifically requested central config

### Alternative: Store config in Zustand store
- Feasible but mixing static config with dynamic state is messy
- Config belongs in a plain JS export, not reactive store state

## Multiplier Table Design

```js
// Category → rarity → { effectName: value }
POWERUP_EFFECTS: {
  jump: {
    bronze: { jumpCount: 3 },
    silver: { jumpCount: 4 },
    gold:   { jumpCount: 5 },
    diamond:{ jumpCount: 6 },
  },
  speed: {
    bronze: { speedMultiplier: 2, knockbackReduction: 0.5 },
    silver: { speedMultiplier: 3, knockbackReduction: 0.33 },
    gold:   { speedMultiplier: 4, knockbackReduction: 0.25 },
    diamond:{ speedMultiplier: 5, knockbackReduction: 0.2 },
  },
  dash: {
    bronze: { dashDuration: 0.5, radialBlurIntensity: 0.8 },
    silver: { dashDuration: 0.8, radialBlurIntensity: 0.9 },
    gold:   { dashDuration: 1.0, radialBlurIntensity: 1.0 },
    diamond:{ dashDuration: 1.3, radialBlurIntensity: 1.2 },
  },
  slide: {
    bronze: { blastPowerMultiplier: 1.5, knockbackMultiplier: 1.0 },
    silver: { blastPowerMultiplier: 2.0, knockbackMultiplier: 1.2 },
    gold:   { blastPowerMultiplier: 2.5, knockbackMultiplier: 1.5 },
    diamond:{ blastPowerMultiplier: 3.0, knockbackMultiplier: 2.0 },
  },
}
```

## PostEffects Activation Design

```js
// Controls post-processing effects triggered by player actions
PLAYER_ACTIONS: {
  slideImpact: {
    effect: 'shockwave',
    intensity: { none: 0, bronze: 0.5, silver: 0.7, gold: 1.0, diamond: 1.5 },
    duration: 0.8,
  },
  speedBoost: {
    effect: 'radialBlur',
    intensity: { none: 0, bronze: 0.2, silver: 0.3, gold: 0.5, diamond: 0.7 },
  },
  dashBoost: {
    effect: 'radialBlur',
    intensity: { none: 0, bronze: 0.6, silver: 0.7, gold: 0.8, diamond: 1.0 },
  },
}
```

## Baseline Config Design

```js
PLAYER_BASELINE: {
  movement: {
    walkSpeed: 8,
    sprintSpeed: 30,
    slideSpeed: 45,
    slideBurstMultiplier: 1.5,
    slideDuration: 0.6,
    jumpVelocity: 38,
    airJumpVelocity: 35,
    maxJumps: 2,
  },
  knockback: {
    baseBlastPower: 250,
    baseUpwardPop: 45,
    speedUpwardPop: 4,       // Override when speed power-up active
    victimKnockbackForce: 3,
    externalKnockbackForce: 250,
    externalVerticalPop: 55,
    knockbackDecayRate: 8,
    stunDuration: 1.2,
  },
  dash: {
    cooldown: 3,
    defaultDuration: 0.3,
    dashSpeed: 90,
  },
  radialBlur: {
    defaultIntensity: 0.8,
    lerpSpeed: 0.15,
  },
  shockwave: {
    baseSize: 100,
    baseAmplitude: 0.5,
    duration: 0.8,
  },
}