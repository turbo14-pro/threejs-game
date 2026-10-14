import { describe, it, expect } from 'vitest';
import {
  BOT_DIFFICULTY,
  BOT_TUNING,
  BOT_NAME_POOL,
  BOT_COMBAT,
  TAG_COOLDOWN,
  advanceBotJump,
  BotBrain,
  buildBotRoster,
  computeAdaptiveDifficulty,
  computeBotInput,
  createBotProfile,
  getBotPowerUpCombatBoost,
  makeBotName,
  normalizeBotCount,
  pickRandomBotNames,
  randomBotName,
  randomTableRespawn,
  resolveImpact,
  selectTarget,
  TABLE_RESPAWN_BOUNDS,
  TABLE_RESPAWN_EXCLUSIONS,
  shouldRegisterTag,
  steerTowards,
} from './BotAI.jsx';
import { getMaxJumps, PLAYER_BASELINE } from '../../config/playerConfig';

// A bot standing still at the origin, with a target 10m away on +X
const botAtOrigin = { x: 0, y: 0, z: 0, rotationY: 0 };
const targetAtTen = { x: 10, y: 0, z: 0 };

describe('BotAI — responds to player position', () => {
  it('advances toward the player instead of idling', () => {
    const { input } = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.hard,
      bot: botAtOrigin,
      target: targetAtTen,
    });

    expect(input.x).toBeGreaterThan(0);
    expect(Math.abs(input.y)).toBeLessThan(0.001);
  });

  it('steers in the opposite direction when the player is behind it', () => {
    const { input } = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.hard,
      bot: botAtOrigin,
      target: { x: -10, y: 0, z: 0 },
    });

    expect(input.x).toBeLessThan(0);
  });

  it('closes the distance over successive frames', () => {
    let bot = { ...botAtOrigin };
    for (let frame = 0; frame < 60; frame++) {
      const { input } = computeBotInput({ time: frame * 0.5, bot, target: targetAtTen });
      bot = { ...bot, x: bot.x + input.x * 0.5, z: bot.z + input.y * 0.5 };
    }

    expect(bot.x).toBeGreaterThan(0);
    expect(Math.hypot(10 - bot.x, bot.z)).toBeLessThan(10);
  });

  it('jumps when the player is on a higher platform', () => {
    const { input } = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.hard,
      bot: botAtOrigin,
      target: { x: 2, y: 6, z: 0 },
    });

    expect(input.jump).toBe(true);
  });

  it('does not jump when the player is on the same level', () => {
    const { input } = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.hard,
      bot: botAtOrigin,
      target: targetAtTen,
    });

    expect(input.jump).toBe(false);
  });

  it('keeps jump intent alive in the air so a double jump can chain', () => {
    // A target 1m up is under the 2.2m ground clearance — not worth a hop from a standstill...
    const grounded = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.hard,
      bot: botAtOrigin,
      target: { x: 2, y: 1, z: 0 },
      grounded: true,
    });
    expect(grounded.input.jump).toBe(false);

    // ...but once the bot is already airborne mid-climb, that same 1m gap is
    // exactly what the follow-up tap (which performs the double jump) needs.
    const airborne = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.hard,
      bot: botAtOrigin,
      target: { x: 2, y: 1, z: 0 },
      grounded: false,
    });
    expect(airborne.input.jump).toBe(true);
  });

  it('freezes for its reaction window before engaging', () => {
    const fresh = computeBotInput({
      time: 0,
      difficulty: BOT_DIFFICULTY.easy,
      bot: botAtOrigin,
      target: targetAtTen,
    });
    const settled = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.easy,
      bot: botAtOrigin,
      target: targetAtTen,
    });

    expect(fresh.debug.reason).toBe('reacting');
    expect(fresh.input.x).toBe(0);
    expect(fresh.input.y).toBe(0);
    expect(settled.debug.reason).toBe('engaging');
    expect(settled.input.x).not.toBe(0);
  });

  it('returns a neutral input when there is no target', () => {
    const { input, debug } = computeBotInput({ time: 5, bot: botAtOrigin, target: null });

    expect(input).toEqual({ x: 0, y: 0, jump: false, sprint: false, slide: false, dash: false });
    expect(debug.reason).toBe('no-target');
  });
});
describe('BotAI — steering math', () => {
  it('matches the world-space direction when the bot is unrotated', () => {
    const steer = steerTowards({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }, 0);

    expect(steer.z).toBeCloseTo(1);
    expect(steer.x).toBeCloseTo(0);
    expect(steer.distance).toBeCloseTo(5);
  });

  it("applies the inverse of PlayerController's applyAxisAngle(rotationY) convention", () => {
    const rotationY = Math.PI / 2;
    const steer = steerTowards({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, rotationY);

    // Round-trip: PlayerController pushes a local direction into world space with
    // applyAxisAngle(Y, rotationY) → x' = x*cos + z*sin, z' = -x*sin + z*cos.
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    const worldX = steer.x * cos + steer.z * sin;
    const worldZ = -steer.x * sin + steer.z * cos;

    expect(worldX).toBeCloseTo(1);
    expect(worldZ).toBeCloseTo(0);
  });

  it('never asks for more than full stick deflection', () => {
    const steer = steerTowards({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 100 }, 0);

    expect(Math.abs(steer.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(steer.z)).toBeLessThanOrEqual(1);
  });

  it('bails out when the bot is already standing on the target', () => {
    const steer = steerTowards({ x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, 0);

    expect(steer).toEqual({ x: 0, z: 0, distance: 0 });
  });
});

describe('BotAI — adaptive difficulty', () => {
  it('makes bots harder while the player is winning', () => {
    const base = BOT_DIFFICULTY.normal;
    const behind = computeAdaptiveDifficulty(-500, base);
    const even = computeAdaptiveDifficulty(0, base);
    const ahead = computeAdaptiveDifficulty(500, base);

    expect(behind).toBeLessThan(even);
    expect(even).toBe(base);
    expect(ahead).toBeGreaterThan(even);
  });

  it('scales with the size of the score gap', () => {
    const small = computeAdaptiveDifficulty(100, BOT_DIFFICULTY.normal);
    const large = computeAdaptiveDifficulty(400, BOT_DIFFICULTY.normal);

    expect(large).toBeGreaterThan(small);
  });

  it('clamps the adaptive nudge so difficulty cannot swing wildly', () => {
    const maxed = computeAdaptiveDifficulty(100000, BOT_DIFFICULTY.normal);
    const floored = computeAdaptiveDifficulty(-100000, BOT_DIFFICULTY.normal);

    expect(maxed).toBeCloseTo(BOT_DIFFICULTY.normal + BOT_TUNING.maxDifficultyStep);
    expect(floored).toBeCloseTo(BOT_DIFFICULTY.normal - BOT_TUNING.maxDifficultyStep);
  });

  it('always returns a difficulty between 0 and 1', () => {
    expect(computeAdaptiveDifficulty(5000, BOT_DIFFICULTY.insane)).toBeLessThanOrEqual(1);
    expect(computeAdaptiveDifficulty(-5000, BOT_DIFFICULTY.easy)).toBeGreaterThanOrEqual(0);
  });

  it('gives higher difficulty bots faster reactions and more speed', () => {
    const easy = createBotProfile(BOT_DIFFICULTY.easy);
    const insane = createBotProfile(BOT_DIFFICULTY.insane);

    expect(insane.reactionTime).toBeLessThan(easy.reactionTime);
    expect(insane.speed).toBeGreaterThan(easy.speed);
  });

  it('promotes a bot that is losing so the match stays competitive', () => {
    const base = createBotProfile(BOT_DIFFICULTY.easy);
    const losing = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.easy,
      bot: botAtOrigin,
      target: targetAtTen,
      targetScore: 600,
      botScore: 0,
    });

    expect(losing.debug.profile.difficulty).toBeGreaterThan(base.difficulty);
  });
});

describe('BotAI — slide attack band', () => {
  it('runs most of the time — sprint anywhere beyond the tight finish', () => {
    const inputs = [4, 8, 15, 40].map((d) => computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: botAtOrigin,
      target: { x: d, y: 0, z: 0 },
    }).input);

    inputs.forEach((input) => expect(input.sprint).toBe(true));
    // Only the tight finish is a walk
    const close = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: botAtOrigin,
      target: { x: BOT_TUNING.turnHardDistance, y: 0, z: 0 },
    });
    expect(close.input.sprint).toBe(false);
  });

  it('slide tackles from attack range all the way into strike range', () => {
    // 8m: inside BOT_COMBAT.attackRange (9) — the tackle is committed from here
    // 2.5m: inside BOT_COMBAT.hitRange — the lunge is still held so it connects
    const inputs = [8, 5, 2.5].map((d) => computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: botAtOrigin,
      target: { x: d, y: 0, z: 0 },
    }).input);

    inputs.forEach((input) => expect(input.slide).toBe(true));
  });

  it('stops sliding once within turn distance so it can finish the approach', () => {
    const close = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: botAtOrigin,
      target: { x: BOT_TUNING.turnHardDistance - 0.5, y: 0, z: 0 },
    });

    expect(close.input.slide).toBe(false);
  });
});

describe('BotAI — per-bot personality', () => {
  it('gives different bots different decision variables for the same difficulty', () => {
    const a = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: botAtOrigin,
      target: targetAtTen,
      personality: { patience: 1.2, speedBias: 0.9, caution: 0.3, reach: 1.1 },
    });
    const b = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: botAtOrigin,
      target: targetAtTen,
      personality: { patience: 0.8, speedBias: 1.15, caution: 0, reach: 0.9 },
    });

    expect(a.debug.profile.reactionTime).not.toBe(b.debug.profile.reactionTime);
    expect(a.debug.profile.attackRange).not.toBe(b.debug.profile.attackRange);
    expect(a.debug.profile.fleeBelow).not.toBe(b.debug.profile.fleeBelow);
  });

  it('seeds personalities from the roster ids so roster bots diverge', () => {
    const roster = buildBotRoster({ count: 3, difficulty: BOT_DIFFICULTY.normal });
    const quirks = roster.map((bot) => {
      const brain = new BotBrain({ difficulty: bot.difficulty, name: bot.name, seed: bot.id });
      return brain.personality;
    });

    const unique = new Set(quirks.map(p => `${p.patience}|${p.speedBias}|${p.caution}`));
    expect(unique.size).toBe(3);
  });
});

describe('BotAI — lobby roster', () => {
  it('spawns the requested number of named bots', () => {
    const roster = buildBotRoster({ count: 3 });

    expect(roster).toHaveLength(3);
    expect(roster.map(b => b.id)).toEqual(['bot-0', 'bot-1', 'bot-2']);
    expect(roster.every(b => b.isBot)).toBe(true);
    expect(roster.every(b => typeof b.name === 'string' && b.name.length > 0)).toBe(true);
  });

  it('gives bots names from the food-fighter pool', () => {
    const roster = buildBotRoster({ count: 3 });
    const names = roster.map(b => b.name);

    names.forEach(name => expect(BOT_NAME_POOL).toContain(name));
  });

  it('picks unique random names within a spawn batch', () => {
    const names = pickRandomBotNames(3);

    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
    names.forEach(name => expect(BOT_NAME_POOL).toContain(name));
  });

  it('rolls a fresh random name on demand', () => {
    const seen = new Set(Array.from({ length: 30 }, () => randomBotName()));

    expect(seen.size).toBeGreaterThan(1);
    seen.forEach(name => expect(BOT_NAME_POOL).toContain(name));
  });

  it('spawns no bots when the count is zero or invalid', () => {
    expect(buildBotRoster({ count: 0 })).toHaveLength(0);
    expect(buildBotRoster({ count: 'nonsense' })).toHaveLength(0);
    expect(buildBotRoster()).toHaveLength(0);
  });

  it('never spawns more bots than the arena supports', () => {
    expect(buildBotRoster({ count: 99 })).toHaveLength(3);
  });

  it('records the chosen difficulty on each bot so the lobby can display it', () => {
    const roster = buildBotRoster({ count: 2, difficulty: BOT_DIFFICULTY.insane });

    expect(roster.every(b => b.difficulty === BOT_DIFFICULTY.insane)).toBe(true);
    expect(roster.every(b => b.difficultyName === 'insane')).toBe(true);
  });

  it('parses lobby button values into a safe bot count', () => {
    expect(normalizeBotCount('2')).toBe(2);
    expect(normalizeBotCount(1)).toBe(1);
    expect(normalizeBotCount(-4)).toBe(0);
    expect(normalizeBotCount(undefined)).toBe(0);
  });

  it('wraps the name pool instead of producing empty names', () => {
    expect(makeBotName(BOT_NAME_POOL.length)).toBe(BOT_NAME_POOL[0]);
    expect(makeBotName(BOT_NAME_POOL.length + 2)).toBe(BOT_NAME_POOL[2]);
  });

  it('respawns at a random on-table point, never inside an exclusion zone', () => {
    for (let i = 0; i < 50; i++) {
      const spot = randomTableRespawn();
      expect(spot.x).toBeGreaterThanOrEqual(TABLE_RESPAWN_BOUNDS.minX);
      expect(spot.x).toBeLessThanOrEqual(TABLE_RESPAWN_BOUNDS.maxX);
      expect(spot.z).toBeGreaterThanOrEqual(TABLE_RESPAWN_BOUNDS.minZ);
      expect(spot.z).toBeLessThanOrEqual(TABLE_RESPAWN_BOUNDS.maxZ);
      const inside = TABLE_RESPAWN_EXCLUSIONS.some(
        (zone) => spot.x >= zone.minX && spot.x <= zone.maxX && spot.z >= zone.minZ && spot.z <= zone.maxZ,
      );
      expect(inside).toBe(false);
    }
  });

  it('picks a different respawn spot (nearly) every time', () => {
    const spots = Array.from({ length: 20 }, () => randomTableRespawn());
    const unique = new Set(spots.map(s => `${s.x.toFixed(1)},${s.z.toFixed(1)}`));
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('BotAI — scoring tags', () => {
  it('counts a tag when a bot reaches the player', () => {
    const tagged = shouldRegisterTag({ distance: 1.5, lastTagAt: -Infinity, now: 10 });

    expect(tagged).toBe(true);
  });

  it('does not count a tag from across the arena', () => {
    const tagged = shouldRegisterTag({
      distance: BOT_TUNING.engageDistance + 5,
      lastTagAt: -Infinity,
      now: 10,
    });

    expect(tagged).toBe(false);
  });

  it('rate-limits tags so one bot cannot farm the scoreboard', () => {
    expect(shouldRegisterTag({ distance: 1, lastTagAt: 10, now: 11 })).toBe(false);
    expect(shouldRegisterTag({ distance: 1, lastTagAt: 10, now: 10 + TAG_COOLDOWN })).toBe(true);
  });

  it('ignores a missing distance', () => {
    expect(shouldRegisterTag({ distance: null, now: 10 })).toBe(false);
  });
});

describe('BotAI — BotBrain', () => {
  it('accumulates time across frames and keeps producing input', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.hard });

    // Step past the bot's boot-up delay before checking that it engages
    let input = null;
    for (let frame = 0; frame < 30; frame++) {
      input = brain.update(0.05, { bot: botAtOrigin, target: targetAtTen });
    }

    expect(brain.time).toBeCloseTo(1.5);
    expect(input.x).toBeGreaterThan(0);
  });

  it('labels the animation direction for the renderer', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.hard });
    const input = brain.update(1, { bot: botAtOrigin, target: targetAtTen });

    const anim = brain.getAnimationState(input, true);

    expect(anim.mv).toBe(true);
    // Bots always face their travel vector, so the only clip that exists is 'for'
    // (walk_for/run_for). 'back'/'left'/'right' would silently fall back to idle.
    expect(anim.dir).toBe('for');
    expect(anim.jp).toBe('none');
  });

  it('still animates "for" when the target is off to the side (was the idle bug)', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.hard });
    // targetAtTen is straight along +X — the old compass label made this 'right',
    // which has no clip, so the bot glided around on the idle animation.
    const input = brain.update(1, { bot: botAtOrigin, target: targetAtTen });
    const anim = brain.getAnimationState(input, true);

    expect(Math.abs(input.x)).toBeGreaterThan(0.01); // it really is steering sideways
    expect(anim.mv).toBe(true);
    expect(anim.dir).toBe('for');
  });

  it('reports airborne animation state when the bot is not grounded', () => {
    const brain = new BotBrain();

    expect(brain.getAnimationState({ x: 0, y: 0 }, false).jp).toBe('air');
  });

  it('surfaces the jump machine phases so bots play the player jump clips', () => {
    const brain = new BotBrain();

    expect(brain.getAnimationState({ x: 0, y: 0 }, true, 'launch').jp).toBe('launch');
    expect(brain.getAnimationState({ x: 0, y: 0 }, false, 'doublejump').jp).toBe('doublejump');
    expect(brain.getAnimationState({ x: 0, y: 0 }, false, 'air').jp).toBe('air');
    expect(brain.getAnimationState({ x: 0, y: 0 }, false, 'land').jp).toBe('land');
    // No phase passed → the old coarse grounded/airborne mapping still applies
    expect(brain.getAnimationState({ x: 0, y: 0 }, true).jp).toBe('none');
  });

  it('emits jump as one-frame taps while a higher target persists', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.hard, seed: 'pulse' });
    const taps = [];
    for (let i = 0; i < 30; i++) {
      taps.push(brain.update(0.1, {
        bot: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 8, z: 0 },
        grounded: true,
      }).jump);
    }

    // The dwell + cooldown gate eventually commits...
    expect(taps.some(Boolean)).toBe(true);
    // ...but never holds across frames: each commit is a single-frame tap — the
    // re-press that the player's edge-triggered double jump (advanceBotJump) consumes.
    for (let i = 1; i < taps.length; i++) {
      expect(taps[i] && taps[i - 1]).toBe(false);
    }
  });

  it('flags slide animation state when the bot commits to a lunge', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.normal });

    // Inside attack range → the brain sets input.slide; getAnimationState must
    // surface it as `sl` so PlayerModel plays the slide clip (was missing → the
    // impact landed but the model kept running).
    const sliding = brain.getAnimationState({ x: 0.5, y: 0.5, slide: true }, true);
    const notSliding = brain.getAnimationState({ x: 0.5, y: 0.5, slide: false }, true);

    expect(sliding.sl).toBe(true);
    expect(notSliding.sl).toBe(false);
  });


  it('tracks the bot name for lobby display', () => {
    const brain = new BotBrain({ name: BOT_NAME_POOL[2] });

    expect(brain.name).toBe(BOT_NAME_POOL[2]);
  });

describe('BotAI — power-up → combat boost', () => {
  it('returns base BOT_COMBAT values with no power-up', () => {
    const boost = getBotPowerUpCombatBoost(null);

    expect(boost.slideSpeedBias).toBe(BOT_COMBAT.slideSpeedBias);
    expect(boost.knockbackForce).toBe(BOT_COMBAT.knockbackForce);
  });

  it('leaves combat untouched for non-slide power-ups (speed/jump/dash stay inert)', () => {
    for (const category of ['speed', 'jump', 'dash']) {
      const boost = getBotPowerUpCombatBoost({ category, rarity: 'diamond' });
      expect(boost.slideSpeedBias).toBe(BOT_COMBAT.slideSpeedBias);
      expect(boost.knockbackForce).toBe(BOT_COMBAT.knockbackForce);
    }
  });

  it('scales slide lunge speed and knockback by the slide rarity multipliers', () => {
    const gold = getBotPowerUpCombatBoost({ category: 'slide', rarity: 'gold' });

    // gold: blastPowerMultiplier 1.70, knockbackMultiplier 1.5
    expect(gold.slideSpeedBias).toBeCloseTo(BOT_COMBAT.slideSpeedBias * 1.70);
    expect(gold.knockbackForce).toBeCloseTo(BOT_COMBAT.knockbackForce * 1.5);
  });

  it('diamond slide is the strongest tier', () => {
    const diamond = getBotPowerUpCombatBoost({ category: 'slide', rarity: 'diamond' });
    const bronze = getBotPowerUpCombatBoost({ category: 'slide', rarity: 'bronze' });

    // diamond: 2.0x blast + 2.0x knockback; bronze: 1.0x/1.0x (no change)
    expect(diamond.slideSpeedBias).toBeCloseTo(BOT_COMBAT.slideSpeedBias * 2.0);
    expect(diamond.knockbackForce).toBeCloseTo(BOT_COMBAT.knockbackForce * 2.0);
    expect(bronze.slideSpeedBias).toBe(BOT_COMBAT.slideSpeedBias);
    expect(bronze.knockbackForce).toBe(BOT_COMBAT.knockbackForce);
  });

  it('falls back to base values for an unknown slide rarity', () => {
    const boost = getBotPowerUpCombatBoost({ category: 'slide', rarity: 'mythic' });

    expect(boost.slideSpeedBias).toBe(BOT_COMBAT.slideSpeedBias);
    expect(boost.knockbackForce).toBe(BOT_COMBAT.knockbackForce);
  });
});

describe('BotAI — target detection & player preference', () => {
  const botAtOrigin = { x: 0, y: 0, z: 0 };
  // Deterministic aggression so the score math is exact (real bots range 0.25–0.95).
  const personality = { aggression: 0.9 };

  it('prefers the player over an equidistant bot (aggro bias)', () => {
    const chosen = selectTarget(
      botAtOrigin,
      [
        { id: 'bot-1', kind: 'bot', x: 10, y: 0, z: 0, health: 100 },
        { id: 'player', kind: 'player', x: 10, y: 0, z: 0, health: 100 },
      ],
      personality,
    );

    expect(chosen.id).toBe('player');
  });

  it('chases the player from well beyond a closer bot (increased detection)', () => {
    // aggression 0.9 × playerAggroBonus 20 = 18m of "pull". A player 20m out still
    // beats a bot at 3m (17m gap) — with the old bonus (8) the bot would have won,
    // so this proves the detection/aggro distance increased.
    const chosen = selectTarget(
      botAtOrigin,
      [
        { id: 'bot-1', kind: 'bot', x: 3, y: 0, z: 0, health: 100 },
        { id: 'player', kind: 'player', x: 20, y: 0, z: 0, health: 100 },
      ],
      personality,
    );

    expect(chosen.id).toBe('player');
  });

  it('never drops the player as a target, even far outside the detection radius', () => {
    const far = BOT_TUNING.detectionRange + 100;
    const chosen = selectTarget(
      botAtOrigin,
      [{ id: 'player', kind: 'player', x: far, y: 0, z: 0, health: 100 }],
      personality,
    );

    // Tapered pull (never zero) → a lone distant player is still hunted down.
    expect(chosen).not.toBeNull();
    expect(chosen.id).toBe('player');
  });

  it('tapers the aggro pull beyond the detection radius so a close bot can win', () => {
    const far = BOT_TUNING.detectionRange + 100;
    const chosen = selectTarget(
      botAtOrigin,
      [
        { id: 'bot-1', kind: 'bot', x: 5, y: 0, z: 0, health: 100 },
        { id: 'player', kind: 'player', x: far, y: 0, z: 0, health: 100 },
      ],
      personality,
    );

    // Beyond the radius the player pull is halved, so the near bot takes priority.
    expect(chosen.id).toBe('bot-1');
  });

  it('skips downed candidates when picking a target', () => {
    const chosen = selectTarget(
      botAtOrigin,
      [{ id: 'bot-1', kind: 'bot', x: 3, y: 0, z: 0, health: 0 }],
      personality,
    );

    expect(chosen).toBeNull();
  });
});

describe('BotAI — every bot slide-tackles', () => {
  it('enables slide at every difficulty so the adaptive nudge cannot disable it', () => {
    for (const diff of Object.values(BOT_DIFFICULTY)) {
      expect(createBotProfile(diff).slide).toBe(true);
    }
  });

  it('keeps slide on even when adaptive difficulty drops a bot to its floor', () => {
    // A bot losing badly gets nudged down; slide must stay armed regardless.
    const floored = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.easy,
      bot: { x: 0, y: 0, z: 0 },
      target: { x: 6, y: 0, z: 0 },
      targetScore: 0,
      botScore: 100000, // pushes adaptive difficulty toward 0
    });

    expect(floored.input.slide).toBe(true);
  });

  it('commits the slide from the wider attack range', () => {
    // Just inside the new attackRange (12) but beyond strike distance — the lunge
    // should be armed so it connects on approach.
    const far = computeBotInput({
      time: 5,
      difficulty: BOT_DIFFICULTY.normal,
      bot: { x: 0, y: 0, z: 0 },
      target: { x: BOT_COMBAT.attackRange - 1, y: 0, z: 0 },
    });

    expect(far.input.slide).toBe(true);
    expect(BOT_COMBAT.attackRange).toBeGreaterThan(9);
  });
});

describe('BotAI — reduced accuracy (aim error)', () => {
  const bot = { x: 0, y: 0, z: 0 };
  const target = { x: 10, y: 0, z: 0 }; // dead ahead on +X → perfect aim has ~zero lateral (y)

  it('a perfectly accurate bot steers with no aim error', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.normal });
    brain.personality = { ...brain.personality, accuracy: 1, wanderAngle: 0 };
    const pure = computeBotInput({ time: 10, difficulty: BOT_DIFFICULTY.normal, bot, target, personality: brain.personality });

    brain.time = 10;
    const input = brain.update(0, { bot, target });

    // accuracy 1 → errorAngle is exactly 0 → matches the pure (perfect-aim) input
    expect(input.x).toBeCloseTo(pure.input.x, 6);
    expect(input.y).toBeCloseTo(pure.input.y, 6);
  });

  it('an inaccurate bot swerves off the perfect line', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.normal });
    brain.personality = { ...brain.personality, accuracy: 0, wanderAngle: 0 };

    brain.time = 10;
    const input = brain.update(0, { bot, target });

    // Pure aim toward +X keeps y≈0; the aim-error rotation pushes a lateral
    // component in, so an inaccurate bot visibly drifts off the straight line.
    expect(Math.abs(input.y)).toBeGreaterThan(0.01);
    // Still generally advancing toward the target (x stays dominant & positive)
    expect(input.x).toBeGreaterThan(0);
    expect(Math.abs(input.x)).toBeGreaterThan(Math.abs(input.y));
  });

  it('leaves the pure computeBotInput perfect-aim (error is a runtime layer)', () => {
    // computeBotInput itself must stay a perfect-aim pure function.
    const pure = computeBotInput({ time: 10, difficulty: BOT_DIFFICULTY.normal, bot, target });
    expect(pure.input.y).toBeCloseTo(0, 6);
  });
});

describe('BotAI — slide pacing (bots slide less often)', () => {
  const bot = { x: 0, y: 0, z: 0 };
  const inBand = { x: 6, y: 0, z: 0 };    // inside (turnHard, attackRange] → slide intent
  const outOfBand = { x: 40, y: 0, z: 0 };  // beyond attackRange → no slide intent

  it('never slides when slideChance is 0', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.normal });
    brain.personality = { ...brain.personality, slideChance: 0 };

    for (let i = 0; i < 60; i++) {
      const input = brain.update(1 / 60, { bot, target: inBand });
      expect(input.slide).toBe(false);
    }
  });

  it('commits a slide when slideChance is 1 and in range', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.normal });
    brain.personality = { ...brain.personality, slideChance: 1 };

    let slid = false;
    for (let i = 0; i < 60; i++) {
      const input = brain.update(1 / 60, { bot, target: inBand });
      if (input.slide) slid = true;
    }
    expect(slid).toBe(true);
  });

  it('holds the committed lunge, then rests on cooldown before the next', () => {
    const brain = new BotBrain({ difficulty: BOT_DIFFICULTY.normal });
    brain.personality = { ...brain.personality, slideChance: 1 };

    // Advance past the reaction window and commit a lunge while in band.
    for (let i = 0; i < 40; i++) brain.update(0.05, { bot, target: inBand });
    expect(brain.update(0.05, { bot, target: inBand }).slide).toBe(true);

    // Leave the band → the latch releases (no slide intent).
    expect(brain.update(0.05, { bot, target: outOfBand }).slide).toBe(false);

    // Re-enter the band immediately → still cooling down, so no slide yet.
    expect(brain.update(0.05, { bot, target: inBand }).slide).toBe(false);
  });
});




});

describe('BotAI — Newtonian impact resolution (resolveImpact)', () => {
  // a at origin, b at +X. Normal points +X (a → b).
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: 5, y: 0, z: 0 };

  it('names the moving body the aggressor and pushes the still victim away', () => {
    // a drives toward b along +X; b is stationary.
    const r = resolveImpact({ ...A, vx: 30, vz: 0 }, { ...B, vx: 0, vz: 0 });

    expect(r.aggressor).toBe('a');
    expect(r.victim).toBe('b');
    expect(r.closingSpeed).toBeGreaterThan(0);
    // Victim b is pushed further +X (away from a).
    expect(r.knockDir.x).toBeCloseTo(1);
    expect(r.knockDir.z).toBeCloseTo(0);
    expect(r.impact).toBeGreaterThan(0);
    expect(r.impact).toBeLessThanOrEqual(1);
  });

  it('flips the aggressor when the other body is the one moving in', () => {
    // b drives toward a along −X; a is stationary. From a's frame a is 'a', b is 'b'.
    const r = resolveImpact({ ...A, vx: 0, vz: 0 }, { ...B, vx: -30, vz: 0 });

    expect(r.aggressor).toBe('b');
    expect(r.victim).toBe('a');
    // Victim a is pushed along −X (away from b).
    expect(r.knockDir.x).toBeCloseTo(-1);
  });

  it('the reported bug: a player sliding INTO a bot is the aggressor, not the bot', () => {
    // Player (a) slides toward the bot (b) at +X. Bot is sliding AWAY (−X) or sideways,
    // so historically it still launched the player. Now the player must be the aggressor.
    const playerDrivingIn = resolveImpact(
      { ...A, vx: 35, vz: 0 },   // player sliding toward the bot
      { ...B, vx: -10, vz: 0 },  // bot sliding away / another direction
    );
    expect(playerDrivingIn.aggressor).toBe('a'); // player wins → bot should NOT knock the player

    // And a bot sliding sideways (pure +Z) into a still player is still the aggressor.
    const botSideways = resolveImpact(
      { ...A, vx: 0, vz: 0 },    // still player
      { ...B, vx: 0, vz: 30 },   // bot moving +Z... but b is at +X, so its +Z velocity
    );                           // is perpendicular → low closing along the normal
    // Perpendicular motion contributes ~0 closing along the a→b normal, so with the
    // player still, closing speed is below threshold → no aggressor (no cheap knockback).
    expect(botSideways.aggressor).toBeNull();
  });

  it('a faster body wins a head-on clash', () => {
    const r = resolveImpact({ ...A, vx: 20, vz: 0 }, { ...B, vx: -35, vz: 0 });
    // b drives in harder → b is the aggressor.
    expect(r.aggressor).toBe('b');
    expect(r.closingSpeed).toBeGreaterThan(50);
  });

  it('reports no aggressor when neither body is closing (both still / moving apart)', () => {
    const still = resolveImpact({ ...A, vx: 0, vz: 0 }, { ...B, vx: 0, vz: 0 });
    expect(still.aggressor).toBeNull();
    expect(still.impact).toBe(0);

    // Moving apart: a goes −X, b goes +X → gap grows, no closing.
    const apart = resolveImpact({ ...A, vx: -20, vz: 0 }, { ...B, vx: 20, vz: 0 });
    expect(apart.aggressor).toBeNull();
    expect(apart.closingSpeed).toBe(0);
  });

  it('scales impact strength with closing speed and clamps to 1', () => {
    const gentle = resolveImpact({ ...A, vx: 8, vz: 0 }, { ...B, vx: 0, vz: 0 });
    const hard = resolveImpact({ ...A, vx: 40, vz: 0 }, { ...B, vx: 0, vz: 0 });
    const insane = resolveImpact({ ...A, vx: 400, vz: 0 }, { ...B, vx: 0, vz: 0 });

    expect(hard.impact).toBeGreaterThan(gentle.impact);
    expect(insane.impact).toBe(1); // clamped
  });

  it('returns a safe empty result for coincident bodies', () => {
    const r = resolveImpact({ ...A, vx: 30, vz: 0 }, { ...A, vx: 0, vz: 0 });
    expect(r.aggressor).toBeNull();
    expect(r.impact).toBe(0);
  });
});

describe('BotAI — bot jump state machine (advanceBotJump)', () => {
  // The exact velocities PlayerController applies — one source of truth (PLAYER_BASELINE)
  const GROUND_JUMP = PLAYER_BASELINE.movement.jumpVelocity; // 38
  const AIR_JUMP = PLAYER_BASELINE.movement.airJumpVelocity; // 35

  it('launches a ground jump with the player\'s exact velocity', () => {
    // Press while resting → 'launch' phase first (the launch animation beat), no velocity yet
    const start = advanceBotJump({
      jump: true, grounded: true, vy: 0, anim: { launchFrames: 6 }, delta: 0.1,
    });
    expect(start.phase).toBe('launch');
    expect(start.jumpVel).toBeNull();
    expect(start.physicsJumped).toBe(false);

    // ...then the liftoff beat lands: the bot leaves the ground at exactly 38 over
    // the same gravity the player's Rapier body uses → identical single-jump height.
    const liftoff = advanceBotJump({
      ...start, jump: false, grounded: true, vy: 0, anim: { launchFrames: 6 }, delta: 0.1,
    });
    expect(liftoff.jumpVel).toBe(GROUND_JUMP);
    expect(liftoff.jumpVel).toBe(38);
    expect(liftoff.phase).toBe('air');
  });

  it('double jumps in the air with the player\'s air velocity and phase', () => {
    const s = advanceBotJump({
      phase: 'air', vy: 4, grounded: false,
      jump: true, prevJump: false, maxJumps: 2,
      anim: { doublejumpFrames: 20 }, delta: 0.016,
    });

    expect(s.jumpVel).toBe(AIR_JUMP);
    expect(s.jumpVel).toBe(35);
    expect(s.phase).toBe('doublejump'); // PlayerModel plays the doublejump clip for this
    expect(s.jumpCount).toBe(1);
    expect(s.timer).toBeCloseTo(
      Math.max(PLAYER_BASELINE.movement.doubleJumpDuration, 20 / 30) - 0.016,
      5,
    );
  });

  it('ignores a held jump in the air — only a re-press chains, like the player', () => {
    const s = advanceBotJump({
      phase: 'air', vy: 4, grounded: false,
      jump: true, prevJump: true, maxJumps: 2, delta: 0.016,
    });

    expect(s.jumpVel).toBeNull();
    expect(s.jumpCount).toBe(0);
    expect(s.phase).toBe('air');
  });

  it('stops at the base budget: one ground jump + one air jump (maxJumps 2)', () => {
    const first = advanceBotJump({
      phase: 'air', jumpCount: 0, grounded: false,
      jump: true, prevJump: false, maxJumps: 2, delta: 0.016,
    });
    expect(first.jumpVel).toBe(AIR_JUMP);
    expect(first.jumpCount).toBe(1);

    // The budget is spent — the next tap is refused until the bot lands.
    // (Per-frame inputs aren't part of the returned state — re-supply them.)
    const second = advanceBotJump({
      ...first, grounded: false, jump: true, prevJump: false, maxJumps: 2, delta: 0.016,
    });
    expect(second.jumpVel).toBeNull();
    expect(second.jumpCount).toBe(1);
  });

  it('uses every jump a jump power-up grants (gold coin → 5 total)', () => {
    // Same helper the player uses: gold jump coin = maxJumps 5 →
    // one ground jump + FOUR air jumps before the budget runs out.
    const maxJumps = getMaxJumps({ category: 'jump', rarity: 'gold' });
    expect(maxJumps).toBe(5);

    let s = {
      phase: 'air', timer: 0, jumpCount: 0, physicsJumped: true,
      vy: 6, grounded: false, maxJumps, anim: {}, delta: 0.05,
    };
    // Persisted machine state + per-frame inputs, the way BotPlayer drives it
    const step = (state, jump, prevJump) => ({ ...state, ...advanceBotJump({ ...state, jump, prevJump }) });
    let airJumps = 0;
    for (let tap = 0; tap < 6; tap++) {
      s = step(s, true, false);
      if (s.jumpVel === AIR_JUMP) airJumps++;
      s = step(s, false, true); // release frame between taps
    }

    expect(airJumps).toBe(4);
    expect(s.jumpCount).toBe(4);
  });

  it('plays the land phase on touchdown and resets the budget', () => {
    const s = advanceBotJump({
      phase: 'air', jumpCount: 1, vy: -12, grounded: true,
      jump: false, anim: { landFrames: 9 }, delta: 0.016,
    });

    expect(s.phase).toBe('land');
    expect(s.jumpCount).toBe(0);
    expect(s.timer).toBeCloseTo(9 / (30 * 1.6) - 0.016, 5);
  });

  it('finishes the launch liftoff after falling off a ledge mid-launch', () => {
    const s = advanceBotJump({
      phase: 'launch', physicsJumped: false, timer: 0.06,
      grounded: false, jump: false, anim: { launchFrames: 6 }, delta: 0.1,
    });

    expect(s.jumpVel).toBe(GROUND_JUMP);
    expect(s.phase).toBe('air');
  });
});
