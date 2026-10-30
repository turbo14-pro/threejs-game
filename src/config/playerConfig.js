// ---------------------------------------------------------------------------
// playerConfig.js — Central configuration for player mechanics, power-ups,
// and post-effects activation. Single source of truth for all baseline values.
// ---------------------------------------------------------------------------

// ===========================================================================
// PLAYER BASELINE — All hardcoded values extracted from PlayerController.jsx
// ===========================================================================

export const PLAYER_BASELINE = {
    movement: {
        walkSpeed: 4, // units/sec
        sprintSpeed: 35, // units/sec
        slideSpeed: 40, // units/sec
        slideBurstMultiplier: 1, // multiplied by direction on slide start
        slideDuration: 0.6, // seconds
        jumpVelocity: 38, // upward impulse from ground
        airJumpVelocity: 35, // upward impulse from air (double jump)
        maxJumps: 2, // base without power-up
        doubleJumpDuration: 0.2, // seconds before the air state can re-arm for another jump input
    },
    knockback: {
        baseBlastPower: 150, // impulse force for slide impact
        baseUpwardPop: 45, // vertical launch on slide impact
        speedUpwardPop: 4, // vertical launch override when speed power-up active
        victimKnockbackForce: 3, // force applied to victim on collision
        externalKnockbackForce: 250, // base force for external knockback (store trigger)
        externalVerticalPop: 55, // vertical pop for external knockback
        knockbackDecayRate: 8, // multiplier for external force decay per second
        stunDuration: 1.2, // seconds player is stunned after knockback
    },
    dash: {
        cooldown: 1, // seconds between dashes
        duration: 0.3, // seconds (no power-up)
        dashSpeed: 150, // units/sec during dash
        maxDistance: 6, // max travel distance for a dash
        speedMultiplier: 1, // multiplier applied to dash velocity
    },
    radialBlur: {
        defaultIntensity: 0.8, // fallback intensity
        lerpSpeed: 0.15, // lerp factor per frame
    },
    shockwave: {
        baseSize: 30, // max size multiplier
        baseAmplitude: 5.5, // base wave amplitude
        duration: 0.8, // seconds (doubled for slower decay)
    },
};

// ===========================================================================
// POWER-UP DURATIONS — How long each rarity lasts (milliseconds in store)
// ===========================================================================

export const POWERUP_DURATIONS = {
    bronze: 40, // 1 min
    silver: 50, // 1 min 30s
    gold: 60, // 2 min
    diamond: 70, // 3 min
};

// ===========================================================================
// POWER-UP EFFECTS — Multiplier table: category → rarity → { effectName: value }
// Each category can have multiple named multipliers.
// ===========================================================================

export const POWERUP_EFFECTS = {
    jump: {
        bronze: {jumpCount: 3},
        silver: {jumpCount: 4},
        gold: {jumpCount: 5},
        diamond: {jumpCount: 6},
    },
    speed: {
        bronze: {speedMultiplier: 1.25, knockbackReduction: 0.5},
        silver: {speedMultiplier: 1.5, knockbackReduction: 0.33},
        gold: {speedMultiplier: 1.75, knockbackReduction: 0.25},
        diamond: {speedMultiplier: 2.0, knockbackReduction: 0.2},
    },
    dash: {
        bronze: {speedMultiplier: 2, maxDistanceMultiplier: 5},
        silver: {speedMultiplier: 4, maxDistanceMultiplier: 7},
        gold: {speedMultiplier: 6, maxDistanceMultiplier: 9},
        diamond: {speedMultiplier: 8, maxDistanceMultiplier: 12},
    },
    slide: {
        bronze: {blastPowerMultiplier: 1.0, knockbackMultiplier: 1.0},
        silver: {blastPowerMultiplier: 1.25, knockbackMultiplier: 1.2},
        gold: {blastPowerMultiplier: 1.7, knockbackMultiplier: 1.5},
        diamond: {blastPowerMultiplier: 2.0, knockbackMultiplier: 2.0},
    },
};

// ===========================================================================
// PLAYER ACTIONS — Post-processing effects triggered by player actions
// intensity: { none: 0, bronze: X, silver: X, gold: X, diamond: X }
// ===========================================================================

export const PLAYER_ACTIONS = {
    slideImpact: {
        effect: "shockwave",
        intensity: {none: 1.0, bronze: 1.2, silver: 1.5, gold: 2.0, diamond: 2.5},
        duration: 0.4,
    },
    speedBoost: {
        effect: "radialBlur",
        intensity: {none: 0, bronze: 0.05, silver: 0.08, gold: 0.1, diamond: 0.11},
    },
    dashBoost: {
        effect: "radialBlur",
        intensity: {none: 0, bronze: 3, silver: 5, gold: 7, diamond: 9},
    },
};

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Get a specific power-up effect value with fallback chain.
 * @param {string} category - 'jump' | 'speed' | 'dash' | 'slide'
 * @param {string} rarity - 'bronze' | 'silver' | 'gold' | 'diamond'
 * @param {string} effectName - e.g. 'speedMultiplier', 'jumpCount', etc.
 * @returns {number} The effect value, or 1.0 if not found (safe no-op default)
 */
export function getPowerUpEffect(category, rarity, effectName) {
    // No power-up active — return 1.0 (no-op multiplier)
    if (!rarity) return 1.0;
    const catEffects = POWERUP_EFFECTS[category];
    if (!catEffects) return 1.0;
    const rarityEffects = catEffects[rarity] || catEffects.bronze;
    if (!rarityEffects) return 1.0;
    return rarityEffects[effectName] ?? 1.0;
}

/**
 * Get the intensity of a player action effect for a given rarity.
 * @param {string} actionName - 'slideImpact' | 'speedBoost' | 'dashBoost'
 * @param {string} rarity - 'none' | 'bronze' | 'silver' | 'gold' | 'diamond'
 * @returns {number} Intensity value (0 = off), or 0 if not found
 */
export function getActionIntensity(actionName, rarity = "none") {
    const action = PLAYER_ACTIONS[actionName];
    if (!action) return 0;
    return action.intensity[rarity] ?? action.intensity.none ?? 0;
}

export function canUseDash(powerUp = null) {
    return !powerUp || powerUp.category === "dash";
}

export function shouldEndDash({travelDistance = 0, maxDistance = 0, hSpeed = 0, minTravelForSpeedCheck = 0.5}) {
    if (travelDistance >= maxDistance) return true;
    return travelDistance > minTravelForSpeedCheck && hSpeed < 10;
}

export function getDashConfig(rarity) {
    const baseline = PLAYER_BASELINE.dash;
    const hasPowerUp = Boolean(rarity);
    const speedEffect = getPowerUpEffect("dash", rarity, "speedMultiplier");

    const maxDistanceEffect = getPowerUpEffect("dash", rarity, "maxDistanceMultiplier");

    return {
        cooldown: baseline.cooldown,
        duration: baseline.duration,
        maxDistance:
            hasPowerUp && Number.isFinite(maxDistanceEffect) && maxDistanceEffect > 0
                ? baseline.maxDistance * maxDistanceEffect
                : baseline.maxDistance,
        maxDistanceMultiplier:
            hasPowerUp && Number.isFinite(maxDistanceEffect) && maxDistanceEffect > 0 ? maxDistanceEffect : 1,
        speedMultiplier:
            hasPowerUp && Number.isFinite(speedEffect) && speedEffect > 0 ? speedEffect : baseline.speedMultiplier,
        baseSpeed: baseline.dashSpeed,
    };
}

export function getMaxJumps(powerUp = null) {
    if (powerUp?.category === "jump") {
        const jumpCount = getPowerUpEffect("jump", powerUp.rarity, "jumpCount");
        return Number.isFinite(jumpCount) && jumpCount > 0 ? jumpCount : PLAYER_BASELINE.movement.maxJumps;
    }

    return PLAYER_BASELINE.movement.maxJumps;
}

// ===========================================================================
// POWER-UP DESCRIPTIONS — Labels, hints, icons, colors for UI
// ===========================================================================

export const POWERUP_DESCRIPTIONS = {
    jump: {
        label: "Jump",
        hint: (rarity) => `You can jump ${getPowerUpEffect("jump", rarity, "jumpCount")} times!`,
        icon: "materials/items/powerup.jump.svg",
        color: "#00ff88",
    },
    speed: {
        label: "Speed",
        hint: (rarity) => `${getPowerUpEffect("speed", rarity, "speedMultiplier")}x movement speed!`,
        icon: "materials/items/powerup.run.svg",
        color: "#ff8800",
    },
    dash: {
        label: "Dash",
        hint: () => "Dash forward instantly! Press Q",
        icon: "materials/items/powerup.dash.svg",
        color: "#4488ff",
    },
    slide: {
        label: "Slide",
        hint: (rarity) => `${getPowerUpEffect("slide", rarity, "blastPowerMultiplier")}x slide power! Press C`,
        icon: "materials/items/powerup.slide.svg",
        color: "#ff44ff",
    },
};
