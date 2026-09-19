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
};

// Naming pool for lobby display — deterministic so bots keep their identity between rounds
export const BOT_NAME_POOL = ['Bot Byte', 'Bot Crumb', 'Bot Munch', 'Bot Nibbler'];

const DIRECTIONS = ['for', 'back', 'left', 'right'];

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

/**
 * Difficulty preset → a fully resolved profile the runtime can consume.
 */
export function createBotProfile(difficulty = BOT_DIFFICULTY.normal) {
  const d = clamp01(difficulty);
  return {
    difficulty: d,
    reactionTime: BOT_TUNING.reactionBase + (BOT_TUNING.reactionFast - BOT_TUNING.reactionBase) * d,
    speed: 0.45 + 0.4 * d,
    sprint: d >= 0.5,
    jump: d >= 0.3,
    slide: d >= 0.6,
    dash: d >= 0.7,
    aggression: d,
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
  } = snapshot;

  const botPos = toVector(bot);
  const targetPos = toVector(target);
  const adaptive = computeAdaptiveDifficulty(targetScore - botScore, difficulty);
  const profile = createBotProfile(adaptive);
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

  // --- MOVEMENT ---
  input.x = steer.x * profile.speed;
  input.y = steer.z * profile.speed;
  // Sprint when far away, ease off when close so bots don't overshoot
  input.sprint = profile.sprint && distance > BOT_TUNING.turnHardDistance * 2;
  // Slide-in as a closing move
  input.slide = profile.slide
    && distance > BOT_TUNING.engageDistance * 3
    && distance < BOT_TUNING.engageDistance * 6;
  // Dash into the target once inside strike range, on a cadence so it isn't spammy
  const dashWindow = Math.max(1, 3 - 2 * profile.aggression);
  input.dash = profile.dash
    && distance <= BOT_TUNING.strikeDistance
    && distance > BOT_TUNING.turnHardDistance
    && (time % dashWindow) < 0.1;
  // Hop when the target is meaningfully above us (chasing onto a platform)
  input.jump = profile.jump && (targetPos.y - botPos.y) > BOT_TUNING.jumpClearance;

  // --- AIM: try to face the target (models look down -Z) ---
  const targetRotationY = Math.atan2(-(targetPos.x - botPos.x), -(targetPos.z - botPos.z));

  return {
    input: reacting ? { ...input, x: 0, y: 0, dash: false, slide: false } : input,
    debug: {
      profile,
      distance,
      reason: reacting ? 'reacting' : 'engaging',
      targetRotationY,
      reactionAt,
      reactionRemaining: Math.max(0, reactionAt - time),
    },
  };
}

/**
 * Deterministic, unique bot name. `index` is the lobby slot so two bots never clash.
 */
export function makeBotName(index = 0, pool = BOT_NAME_POOL) {
  const names = Array.isArray(pool) && pool.length ? pool : BOT_NAME_POOL;
  return names[Math.abs(Math.trunc(index)) % names.length];
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
 * Builds the immutable bot roster used by the lobby/HUD and the runtime renderer.
 * Only its parameters affect the result — no randomness — so we can sync the roster into
 * the store and still identify each spawned bot by id afterwards.
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

  return Array.from({ length: total }, (_, index) => ({
    id: `bot-${index}`,
    name: makeBotName(index),
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
  constructor({ difficulty = BOT_DIFFICULTY.normal, name = BOT_NAME_POOL[0] } = {}) {
    this.name = name;
    this.difficulty = difficulty;
    this.time = 0;
    this.direction = 'for';
    this.lastDebug = null;
  }

  /** Advance the clock and return the fresh input frame. */
  update(delta, snapshot = {}) {
    this.time += Number.isFinite(delta) ? delta : 0;
    const result = computeBotInput({
      time: this.time,
      difficulty: this.difficulty,
      ...snapshot,
    });

    // Keep the animation direction label in sync with the steering vector
    if (Math.abs(result.input.x) > Math.abs(result.input.y)) {
      this.direction = result.input.x >= 0 ? 'right' : 'left';
    } else if (Math.abs(result.input.y) > 0) {
      this.direction = result.input.y >= 0 ? 'for' : 'back';
    } else {
      this.direction = 'for';
    }

    this.lastDebug = result.debug;
    return result.input;
  }

  /** Mirrors PlayerController's animation vocabulary for PlayerModel. */
  getAnimationState(input = { x: 0, y: 0 }, grounded = true) {
    const moving = Math.abs(input.x || 0) > 0.01 || Math.abs(input.y || 0) > 0.01;
    return {
      mv: moving,
      dir: DIRECTIONS.includes(this.direction) ? this.direction : 'for',
      spr: !!input.sprint,
      jp: grounded ? 'none' : 'air',
    };
  }
}

export default BotBrain;
