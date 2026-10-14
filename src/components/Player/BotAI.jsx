/**
 * THE BOT BRAIN
 * Pure heuristic logic for CPU opponents. Deliberately framework-free so it can be
 * unit-tested and reused by both the client renderer and (potentially) the server.
 *
 * A bot only ever produces a `mobileInput`-shaped object:
 *   { x, y, jump, sprint, slide, dash }
 * PlayerController already merges `store.mobileInput` into its keyboard input, so a bot
 * can reuse the human movement / physics / dash / slide pipeline without changes there.
 */

import { POWERUP_EFFECTS } from '../../config/playerConfig';

// Difficulty presets — 0 (easy) → 1 (ruthless)
export const BOT_DIFFICULTY = {
  easy:   0.25,
  normal: 0.45,
  hard:   0.7,
  insane: 0.95,
};

// Tunables for the adaptive heuristic
export const BOT_TUNING = {
  scoreGapPerStep: 250,  // score lead needed to shift difficulty by a full step
  maxDifficultyStep: 0.3,// adaptive nudge is clamped to ±0.3
  reactionBase: 0.62,    // seconds before reacting to a new target (at difficulty 0)
  reactionFast: 0.1,     // seconds before reacting to a new target (at difficulty 1)
    engageDistance: 3.2,   // how close (metres) a bot wants to be before "strike" range
  strikeDistance: 4.5,   // distance at which the bot will dash/attack
  jumpClearance: 2.2,    // height difference that makes a bot prefer to jump
  turnHardDistance: 2.0, // distance under which steering eases off to avoid overshoot
  jumpDwell: 0.35,       // target must stay above jumpClearance this long before the bot commits
  jumpCooldown: 0.6,     // a bot won't chain-jump (prevents mirroring a player's repeated jumps)
  powerupSeekDistance: 7, // a token closer than this is worth breaking off to collect (normal+ only)
};

// Naming pool for the floating name tags — a fresh random name from this list
// is picked on every spawn and every respawn, so tags keep changing.
export const BOT_NAME_POOL = [
  'Mr. Feast',
  'IShowSeed',
  'Steak Paul',
  'Lionel Cheesy',
  'Cider-Man',
  'Avacado Ronaldo',
  "Fryin' Man",
  'Soup-erman',
  'Breadpool',
  'Bob',
  "S'more",
];

/**
 * Random name from the pool — different (almost) every call. `rng` is injectable
 * so tests can seed it; the game passes nothing and gets Math.random.
 */
export const randomBotName = (rng = Math.random) => {
  const pool = BOT_NAME_POOL;
  return pool[Math.floor(rng() * pool.length) % pool.length];
};

// Seconds between a bot's scoring tags (see shouldRegisterTag)
export const TAG_COOLDOWN = 2.5;

// Bots retreat below this health fraction — recorded project decision:
// ".memory/decisions_log.md → 2026-04-10 · Bot AI: Flee at 25% Health"
export const FLEE_HEALTH = 0.25;

// --- COMBAT -------------------------------------------------------------------
// Bots attack with a slide lunge. Landing one damages the victim and knocks them back.
export const BOT_COMBAT = {
  maxHealth: 100,
  hitDamage: 12,
  hitCooldown: 1.2,      // seconds between a bot's own landed hits
  hitRange: 2.8,         // centre-to-centre distance that counts as a landing
  attackRange: 9,        // distance at which a committed bot launches a slide attack
  slideSpeedBias: 1.9,   // horizontal speed multiplier during the slide lunge
  slideLinger: 0.35,     // seconds the lunge stays armed after the slide input drops
                         // (the strike window is narrower than one frame at lunge speed)
  knockbackForce: 170,
  knockbackDuration: 0.55,
  knockbackPop: 13,      // upward velocity given to a knocked-back victim
  respawnDelay: 3,       // seconds before a downed bot is back on the arena
};

// ---------------------------------------------------------------------------
// POWER-UP → COMBAT BOOST
// A `slide` coin makes the bot lunge faster and hit harder for the buff's
// duration (mirrors the player's slide power-up: blast power + knockback).
// Every other category — and no power-up — is a no-op that returns the base
// BOT_COMBAT values, so jump/dash/speed coins never change bot combat.
// ---------------------------------------------------------------------------
export function getBotPowerUpCombatBoost(powerUp) {
  const base = {
    slideSpeedBias: BOT_COMBAT.slideSpeedBias,
    knockbackForce: BOT_COMBAT.knockbackForce,
  };
  if (!powerUp || powerUp.category !== 'slide') return base;
  const fx = POWERUP_EFFECTS.slide?.[powerUp.rarity];
  if (!fx) return base;
  return {
    slideSpeedBias: base.slideSpeedBias * (Number.isFinite(fx.blastPowerMultiplier) ? fx.blastPowerMultiplier : 1),
    knockbackForce: base.knockbackForce * (Number.isFinite(fx.knockbackMultiplier) ? fx.knockbackMultiplier : 1),
  };
}


// --- ARENA GEOMETRY -----------------------------------------------------------
// From Arena.jsx: the battle table's top surface is y=0 (RigidBody [0,-1,0] + 600x2x600),
// while the lobby platform's surface is y=101 (RigidBody [0,100,0] + 70x2x30).
export const ARENA_SURFACE_Y = 0;
export const LOBBY_SURFACE_Y = 101;
// BotPlayer uses <CapsuleCollider args={[1.5, 1]} /> → halfHeight + radius = 2.5 above the feet,
// so a bot resting on a surface has its body centre this far above it.
export const BOT_BODY_OFFSET_Y = 2.5;
// Spawn ring around the lobby platform, all clear of Arena.jsx's PLATFORM_ZONES
// (those are the footprints the player's drop deliberately avoids).
export const ARENA_SPAWNS = [
  { x: 0, z: -92 },
  { x: 70, z: 6 },
  { x: -70, z: 6 },
];
export const botSpawnPosition = (index = 0) => {
  const spot = ARENA_SPAWNS[Math.abs(Math.trunc(index)) % ARENA_SPAWNS.length];
  return { x: spot.x, y: ARENA_SURFACE_Y + BOT_BODY_OFFSET_Y, z: spot.z };
};

// --- TABLE RESPAWN ------------------------------------------------------------
// The battle table's top surface spans x/z ∈ [-290, 290] (Arena.jsx: 600×600 box
// at [0,-1,0]). A bot that falls off respawns at a fresh random point on the table
// every time — exclusion zones keep it clear of the raised platforms/bridge, matching
// PowerUpManager's spawn rules.
export const TABLE_RESPAWN_BOUNDS = { minX: -280, maxX: 280, minZ: -280, maxZ: 280 };
export const TABLE_RESPAWN_EXCLUSIONS = [
  { minX: -35, maxX: 35, minZ: -15, maxZ: 15 },        // Platform 1
  { minX: -35, maxX: 35, minZ: -60, maxZ: -30 },       // Platform 2
  { minX: -7.5, maxX: 7.5, minZ: -32.5, maxZ: -12.5 }, // Bridge
];
/**
 * Random on-table respawn point — different every call. `rng` is injectable so
 * tests can seed it; the game passes nothing and gets Math.random.
 */
export const randomTableRespawn = (rng = Math.random) => {
  const { minX, maxX, minZ, maxZ } = TABLE_RESPAWN_BOUNDS;
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    const inside = TABLE_RESPAWN_EXCLUSIONS.some(
      (zone) => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ,
    );
    if (!inside) return { x, y: ARENA_SURFACE_Y + BOT_BODY_OFFSET_Y, z };
  }
  // Fallback (practically unreachable): centre of the table.
  return { x: 0, y: ARENA_SURFACE_Y + BOT_BODY_OFFSET_Y, z: -92 };
};

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const toVector = (p) => {
  if (!p) return null;
  if (Array.isArray(p)) {
    return p.length >= 3 ? { x: p[0], y: p[1], z: p[2] } : null;
  }
  if (typeof p.x === 'number' && typeof p.z === 'number') {
    return { x: p.x, y: Number.isFinite(p.y) ? p.y : 0, z: p.z };
  }
  return null;
};

// --- PERSONALITY --------------------------------------------------------------
/**
 * Stable string → 0..1 hash (FNV-1a). Deterministic so every bot keeps the same
 * character between rounds, and so behaviour is testable without seeding.
 */
const hashSeed = (seed) => {
  const text = String(seed ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const round3 = (value) => Math.round(value * 1000) / 1000;

/**
 * Every bot gets its OWN decision variables, derived deterministically from its id.
 * Two bots given the same position, difficulty and clock will still behave differently.
 *
 * @param {string} seed usually the bot id ('bot-0', 'bot-1', ...)
 */
export function createBotPersonality(seed = 'bot') {
  const a = hashSeed(seed);          // primary traits
  const b = hashSeed(`${seed}#2`);   // independent second stream
  const c = hashSeed(`${seed}#3`);   // independent third stream

  return Object.freeze({
    seed: String(seed),
    aggression: round3(0.25 + a * 0.7),   // appetite for attacking
    patience:   round3(0.55 + b * 0.95),  // reaction-time multiplier (higher = slower to react)
    caution:    round3(0.2 + c * 0.7),    // flees earlier when hurt
    reach:      round3(0.8 + a * 1.4),    // slide-attack range multiplier
    speedBias:  round3(0.85 + b * 0.35),  // cruise-speed multiplier
    jumpiness:  round3(0.6 + c * 1.1),    // eagerness to jump for higher ground
    wanderAngle: round3(c * Math.PI * 2), // idle patrol heading
  });
}

/**
 * Picks which enemy a bot should go after.
 *
 * - Always excludes itself (by `id`) and anything already downed.
 * - Close targets beat distant ones.
 * - Aggressive bots are drawn to the human (`kind: 'player'`); everyone loves an
 *   easy meal, so weakened targets are favoured too.
 *
 * @param {object} botPos                     { x, z } (y optional)
 * @param {Array} candidates                  [{ id, kind, x, y, z, health }]
  * @param {object} personality                from createBotPersonality
 * @param {object} [opts]
 * @param {boolean} [opts.seekPowerups]       whether bots should consider powerup tokens
 * @param {number}  [opts.powerupSeekDistance] max metres at which a token is worth grabbing
 * @returns {object|null} the chosen candidate, augmented with distance/score
 */
export function selectTarget(botPos, candidates = [], personality = createBotPersonality(), opts = {}) {
  const from = toVector(botPos);
  if (!from || !Array.isArray(candidates)) return null;

  const seekPowerups = !!opts.seekPowerups;
  const powerupRange = opts.powerupSeekDistance ?? BOT_TUNING.powerupSeekDistance;

  // Powerup tokens: the closest token within range is preferred over combat so bots
  // break off and seek upgrades as a secondary primary aim (normal+ difficulty only).
  if (seekPowerups) {
    let nearestToken = null;
    let nearestTokenDist = powerupRange;
    for (const candidate of candidates) {
      if (candidate?.kind !== 'powerup') continue;
      const pos = toVector(candidate);
      if (!pos) continue;
      const distance = Math.hypot(pos.x - from.x, pos.z - from.z);
      if (distance < nearestTokenDist) {
        nearestTokenDist = distance;
        nearestToken = { id: candidate.id, kind: 'powerup', x: pos.x, y: pos.y, z: pos.z, distance, score: distance };
      }
    }
    if (nearestToken) return nearestToken;
  }

  let best = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Number.isFinite(candidate.health) && candidate.health <= 0) continue;

    const pos = toVector(candidate);
    if (!pos) continue;

    const distance = Math.hypot(pos.x - from.x, pos.z - from.z);
    const healthRatio = Number.isFinite(candidate.health)
      ? clamp01(candidate.health / BOT_COMBAT.maxHealth)
      : 1;

    const preyBonus = (1 - healthRatio) * 6;                                   // finish the wounded
    const hunterBonus = candidate.kind === 'player' ? personality.aggression * 8 : 0;
    const score = distance - preyBonus - hunterBonus;

    if (!best || score < best.score) {
      best = {
        id: candidate.id,
        kind: candidate.kind || 'bot',
        x: pos.x,
        y: pos.y,
        z: pos.z,
        health: candidate.health,
        distance,
        score: round3(score),
      };
    }
  }

  return best;
}

/**
 * Difficulty preset → a fully resolved profile the runtime can consume.
 * `personality` modulates the preset so each bot has unique decision variables.
 */
export function createBotProfile(difficulty = BOT_DIFFICULTY.normal, personality = null) {
  const person = personality || createBotPersonality('default');
  const d = clamp01(difficulty);
  return {
    difficulty: d,
    reactionTime: (BOT_TUNING.reactionBase + (BOT_TUNING.reactionFast - BOT_TUNING.reactionBase) * d) * person.patience,
    speed: (0.45 + 0.4 * d) * person.speedBias,
    sprint: d >= 0.5,
    jump: d >= 0.3,
    slide: d >= BOT_DIFFICULTY.normal,
    dash: d >= 0.7,
    aggression: d,
    attackRange: BOT_COMBAT.attackRange * person.reach,
    jumpThreshold: BOT_TUNING.jumpClearance * person.jumpiness,
    fleeBelow: FLEE_HEALTH * (0.7 + person.caution),
  };
}

/**
 * Adaptive difficulty: a bot gets harder when the human is winning and easier when the
 * human is losing, so matches stay competitive.
 *
 * @param {number} scoreGap playerScore - botScore (positive = human leading)
 * @param {number} baseDifficulty starting difficulty (0-1)
 * @returns {number} difficulty clamped to 0-1
 */
export function computeAdaptiveDifficulty(scoreGap = 0, baseDifficulty = BOT_DIFFICULTY.normal) {
  const gap = Number.isFinite(scoreGap) ? scoreGap : 0;
  const nudge = (gap / BOT_TUNING.scoreGapPerStep) * 0.15;
  const limited = Math.max(-BOT_TUNING.maxDifficultyStep, Math.min(BOT_TUNING.maxDifficultyStep, nudge));
  return clamp01(baseDifficulty + limited);
}

/**
 * The movement direction the bot wants to travel, expressed in the BOT'S OWN frame
 * (moveX = strafe, moveZ = forward) so it matches PlayerController's `mobileInput.x/y`.
 *
 * PlayerController turns a local direction into world space with
 * `applyAxisAngle(Y, rotationY)`, so we apply the inverse rotation here.
 * At `rotationY = 0` (what the kinematic bot runtime uses) the result is simply the
 * world-space direction toward the target.
 */
export function steerTowards(botPos, targetPos, rotationY = 0) {
  const bot = toVector(botPos);
  const target = toVector(targetPos);
  if (!bot || !target) return { x: 0, z: 0, distance: 0 };

  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return { x: 0, z: 0, distance: 0 };

  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const worldX = dx / distance;
  const worldZ = dz / distance;

  return {
    x: Math.max(-1, Math.min(1, worldX * cos - worldZ * sin)),
    z: Math.max(-1, Math.min(1, worldX * sin + worldZ * cos)),
    distance,
  };
}

/**
 * Builds a full bot decision from a plain snapshot of the game state.
 * Pure: same snapshot in → same input out (given the same `time` value).
 *
 * @param {object} snapshot
 *   - {number} time           seconds since the bot spawned
 *   - {number} difficulty     0-1
 *   - {object} bot            { x, y, z, rotationY }
 *   - {object} target         { x, y, z } — usually the human player
 *   - {number} targetScore / {number} botScore
 * @returns {{input: object, debug: object}}
 */
export function computeBotInput(snapshot = {}) {
  const {
    time = 0,
    difficulty = BOT_DIFFICULTY.normal,
    bot,
    target,
    targetScore = 0,
    botScore = 0,
    healthRatio = 1,
    personality = null,
  } = snapshot;

  const botPos = toVector(bot);
  const targetPos = toVector(target);
  const adaptive = computeAdaptiveDifficulty(targetScore - botScore, difficulty);
  const profile = createBotProfile(adaptive, personality);
  const fleeBelow = profile.fleeBelow ?? FLEE_HEALTH;
  const input = { x: 0, y: 0, jump: false, sprint: false, slide: false, dash: false };

  if (!botPos || !targetPos) {
    return { input, debug: { profile, distance: null, reason: 'no-target' } };
  }

  // --- BOOT-UP DELAY: the bot only "notices" the arena once its reaction time has elapsed,
  // so easy bots visibly hesitate at the start of a round.
  const reactionAt = profile.reactionTime;
  const reacting = time < reactionAt;

  const steer = steerTowards(botPos, targetPos, bot.rotationY || 0);
  const distance = steer.distance;

  // --- FLEE MODE: a hurt bot breaks off and runs to regenerate (project decision)
  const fleeing = healthRatio < fleeBelow;
  const travelX = fleeing ? -steer.x : steer.x;
  const travelZ = fleeing ? -steer.z : steer.z;

  // --- MOVEMENT ---
  input.x = travelX * profile.speed;
  input.y = travelZ * profile.speed;
  // RUN most of the time: only ease to a walk in the tight finish so bots don't
  // overshoot the target. Everything beyond close quarters is a run.
  input.sprint = distance > BOT_TUNING.turnHardDistance * 1.2;
  // Slide tackle: committed from attack range and held all the way through the
  // strike window so the lunge can actually connect (hitRange > turnHardDistance).
  input.slide = profile.slide
    && !fleeing
    && distance <= BOT_COMBAT.attackRange
    && distance > BOT_TUNING.turnHardDistance;
  // Dash into the target once inside strike range, on a cadence so it isn't spammy
  const dashWindow = Math.max(1, 3 - 2 * profile.aggression);
  input.dash = profile.dash
    && !fleeing
    && distance <= BOT_TUNING.strikeDistance
    && distance > BOT_TUNING.turnHardDistance
    && (time % dashWindow) < 0.1;
  // Hop when the target is meaningfully above us (chasing onto a platform)
  input.jump = profile.jump && !fleeing && (targetPos.y - botPos.y) > BOT_TUNING.jumpClearance;

  // --- AIM: face the way we are travelling, matching PlayerController's
  // `targetRotationY = Math.atan2(direction.x, direction.z)`.
  const targetRotationY = Math.atan2(travelX, travelZ);

  return {
    input: reacting ? { ...input, x: 0, y: 0, dash: false, slide: false } : input,
    debug: {
      profile,
      distance,
      reason: reacting ? 'reacting' : fleeing ? 'fleeing' : 'engaging',
      targetRotationY,
      reactionAt,
      reactionRemaining: Math.max(0, reactionAt - time),
    },
  };
}

/**
 * Bots score by "tagging" the human — contact inside engage range. This is the only
 * attack the bot runtime can express today, and it gives the adaptive heuristic a live
 * signal for the bot side of the scoreboard.
 *
 * @returns {boolean} true when this tag should count as a point
 */
export function shouldRegisterTag({ distance, lastTagAt = -Infinity, now = 0, cooldown = TAG_COOLDOWN }) {
  if (!Number.isFinite(distance)) return false;
  if (distance > BOT_TUNING.engageDistance) return false;
  return (now - lastTagAt) >= cooldown;
}

/**
 * Deterministic, unique bot name. `index` is the lobby slot so two bots never clash.
 * (Kept for backward compatibility — the game now uses randomBotName instead.)
 */
export function makeBotName(index = 0, pool = BOT_NAME_POOL) {
  const names = Array.isArray(pool) && pool.length ? pool : BOT_NAME_POOL;
  return names[Math.abs(Math.trunc(index)) % names.length];
}

/**
 * Picks `count` random names from the pool, avoiding duplicates within the batch
 * when the pool is big enough (11 names vs 3 bots, so spawns are always unique).
 * `rng` is injectable so tests can seed it.
 */
export function pickRandomBotNames(count = 0, rng = Math.random) {
  const total = Math.max(0, Math.trunc(count));
  const names = [];
  const used = new Set();
  for (let i = 0; i < total; i++) {
    let name = randomBotName(rng);
    // Avoid a duplicate within this batch — bounded retries, then accept any.
    for (let retry = 0; retry < 10 && used.has(name); retry++) {
      name = randomBotName(rng);
    }
    used.add(name);
    names.push(name);
  }
  return names;
}

/**
 * Parses a lobby bot-count selection into a safe number of bots (0-3).
 * Accepts the raw string values used by the menu buttons.
 */
export function normalizeBotCount(value) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(parsed)));
}

/**
 * Builds the immutable bot roster used by the runtime renderer.
 * Each bot gets a random name from the pool (unique within the batch), so the
 * floating tags differ every match.
 *
 * @param {object} options
 *   - {number|string} count   how many bots to spawn (0-3)
 *   - {number} difficulty     one of BOT_DIFFICULTY
 *   - {number} baseScore      starting score for the bots
 * @returns {Array<{id, name, isBot, difficultyName, difficulty, score}>}
 */
export function buildBotRoster({ count = 0, difficulty = BOT_DIFFICULTY.normal, baseScore = 0 } = {}) {
  const total = normalizeBotCount(count);
  const difficultyName = Object.keys(BOT_DIFFICULTY).find(
    (key) => BOT_DIFFICULTY[key] === difficulty
  ) || 'normal';
  const names = pickRandomBotNames(total);

  return Array.from({ length: total }, (_, index) => ({
    id: `bot-${index}`,
    name: names[index] ?? randomBotName(),
    isBot: true,
    difficultyName,
    difficulty,
    score: baseScore,
  }));
}

/**
 * A tiny stateful wrapper so the React renderer can drive a bot across frames without
 * re-deriving everything in the component body. Optional — `computeBotInput` is usable alone.
 */
export class BotBrain {
  constructor({ difficulty = BOT_DIFFICULTY.normal, name = BOT_NAME_POOL[0], seed = null } = {}) {
    this.name = name;
    this.difficulty = difficulty;
    // Each bot gets its own decision variables derived from a stable seed
    this.personality = createBotPersonality(seed ?? name);
    this.time = 0;
    this.lastDebug = null;
  }

  /** Advance the clock and return the fresh input frame. */
  update(delta, snapshot = {}) {
    this.time += Number.isFinite(delta) ? delta : 0;
    const result = computeBotInput({
      time: this.time,
      difficulty: this.difficulty,
      personality: this.personality,
      ...snapshot,
    });

    this.lastDebug = result.debug;

    // --- JUMP GATING ---
    // A bot should chase a target that is on a higher *surface*, not mirror a player's
    // momentary jump. Require the height gap to persist for `jumpDwell` and enforce a
    // per-bot `jumpCooldown` so repeated jumps aren't echoed. (computeBotInput is pure
    // and still reports the raw intent; this is where the runtime commits to it.)
    const botY = snapshot.bot?.y ?? 0;
    const tgtY = snapshot.target?.y ?? 0;
    const gap = tgtY - botY;
    if (gap > BOT_TUNING.jumpClearance) {
      if (this._gapSince == null) this._gapSince = this.time;
    } else {
      this._gapSince = null;
    }
    const dwellOk = this._gapSince != null && (this.time - this._gapSince) >= BOT_TUNING.jumpDwell;
    const cooldownOk = this._nextJump == null || this.time >= this._nextJump;
    if (result.input.jump && (!dwellOk || !cooldownOk)) {
      result.input.jump = false;
    } else if (result.input.jump) {
      this._gapSince = null;
      this._nextJump = this.time + BOT_TUNING.jumpCooldown;
    }

    return result.input;
  }

  /**
   * Mirrors PlayerController's animation vocabulary for PlayerModel.
   *
   * A bot's model is rotated every frame to face its travel vector (BotPlayer's
   * facing step: targetRotationY = atan2(travelX, travelZ)), so in MODEL space a
   * bot always moves forward. PlayerModel only ships walk/run clips for 'for' and
   * 'bac' — there are no left/right/back clips, and an unmatched clip name
   * silently falls back to idle. Emitting 'left'/'right'/'back' here is what made
   * bots glide around the arena on the idle animation whenever their target was
   * off to the side. Always report 'for' so a moving bot plays walk_for/run_for.
   */
  getAnimationState(input = { x: 0, y: 0 }, grounded = true) {
    const moving = Math.abs(input.x || 0) > 0.01 || Math.abs(input.y || 0) > 0.01;
    return {
      mv: moving,
      dir: 'for',
      spr: !!input.sprint,
      jp: grounded ? 'none' : 'air',
    };
  }
}

export default BotBrain;
