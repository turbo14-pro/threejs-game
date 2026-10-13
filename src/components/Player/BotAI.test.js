import { describe, it, expect } from 'vitest';
import {
  BOT_DIFFICULTY,
  BOT_TUNING,
  BOT_NAME_POOL,
  TAG_COOLDOWN,
  BotBrain,
  buildBotRoster,
  computeAdaptiveDifficulty,
  computeBotInput,
  createBotProfile,
  makeBotName,
  normalizeBotCount,
  randomTableRespawn,
  TABLE_RESPAWN_BOUNDS,
  TABLE_RESPAWN_EXCLUSIONS,
  shouldRegisterTag,
  steerTowards,
} from './BotAI.jsx';

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

  it('gives bots unique, human-readable names for the lobby', () => {
    const roster = buildBotRoster({ count: 3 });
    const names = roster.map(b => b.name);

    expect(new Set(names).size).toBe(3);
    names.forEach(name => expect(name).toMatch(/^Bot /));
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
    expect(['for', 'back', 'left', 'right']).toContain(anim.dir);
    expect(anim.jp).toBe('none');
  });

  it('reports airborne animation state when the bot is not grounded', () => {
    const brain = new BotBrain();

    expect(brain.getAnimationState({ x: 0, y: 0 }, false).jp).toBe('air');
  });

  it('tracks the bot name for lobby display', () => {
    const brain = new BotBrain({ name: BOT_NAME_POOL[2] });

    expect(brain.name).toBe(BOT_NAME_POOL[2]);
  });
});