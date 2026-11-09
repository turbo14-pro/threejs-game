/**
 * Bot roster builder — extracted from BotAI.jsx so the store no longer
 * imports from a component file (bundle-barrel-imports violation).
 *
 * Pure, framework-free: builds the immutable bot roster used by the runtime
 * renderer. Each bot gets a random name from the pool (unique within the batch).
 */

// Difficulty presets — 0 (easy) → 1 (ruthless)
export const BOT_DIFFICULTY = {
  easy: 0.25,
  normal: 0.45,
  hard: 0.7,
  insane: 0.95,
};

// Naming pool for the floating name tags
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

export const randomBotName = (rng = Math.random) => {
  const pool = BOT_NAME_POOL;
  return pool[Math.floor(rng() * pool.length) % pool.length];
};

export const pickRandomBotNames = (count = 0, rng = Math.random) => {
  const total = Math.max(0, Math.trunc(count));
  const names = [];
  const used = new Set();
  for (let i = 0; i < total; i++) {
    let name = randomBotName(rng);
    for (let retry = 0; retry < 10 && used.has(name); retry++) {
      name = randomBotName(rng);
    }
    used.add(name);
    names.push(name);
  }
  return names;
};

export const normalizeBotCount = (value) => {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(parsed)));
};

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
export function buildBotRoster({
  count = 0,
  difficulty = BOT_DIFFICULTY.normal,
  baseScore = 0,
} = {}) {
  const total = normalizeBotCount(count);
  const difficultyName =
    Object.keys(BOT_DIFFICULTY).find((key) => BOT_DIFFICULTY[key] === difficulty) ||
    'normal';
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
