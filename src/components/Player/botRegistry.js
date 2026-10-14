/**
 * BOT REGISTRY
 * Module-level shared state so bots can see and attack each other (and expose their
 * health), mirroring the setLocalPlayerWorldPos / getLocalPlayerWorldPos pattern used
 * by PlayerController and PowerUpCoin.jsx.
 */

const bots = new Map();

/**
 * Registers one bot so other bots can target it.
 * @param {string} id
 * @param {object} api { getPosition: () => {x,y,z}, takeDamage: (amount, from) => {} }
 */
export const registerBot = (id, api) => { bots.set(id, api); };
export const unregisterBot = (id) => { bots.delete(id); };

/** All other bots as target candidates: [{ id, kind: 'bot', x, y, z, health }] */
export const getBotCandidates = (excludeId) => {
  const list = [];
  for (const [id, api] of bots) {
    if (id === excludeId || !api) continue;
    const pos = api.getPosition();
    if (!pos || !Number.isFinite(pos.x)) continue;
    // Skip bots that are downed or eliminated so they're not targeted/attacked
    const health = typeof api.health === 'number' ? api.health : 1;
    if (health <= 0) continue;
    list.push({ id, kind: 'bot', x: pos.x, y: pos.y, z: pos.z, health });
  }
  return list;
};

/** Deliver a hit from an attacker to a bot victim. */
export const damageBot = (id, amount, from) => {
  const api = bots.get(id);
  if (api && typeof api.takeDamage === 'function') api.takeDamage(amount, from);
};

/** Push a bot victim away (kinematic bodies get a displacement hook instead of an impulse). */
export const applyBotKnockback = (id, dir, force) => {
  const api = bots.get(id);
  if (api && typeof api.applyKnockback === 'function') api.applyKnockback(dir, force);
};

/** Living bots' current positions (downed/eliminated bots are skipped).
 *  When cx/cy/cz/radius are given, only bots within `radius` of that point are
 *  returned (used for power-up pickup proximity checks). */
export const getBotPositions = (excludeId, cx, cy, cz, radius) => {
  const list = [];
  const r2 = typeof radius === 'number' ? radius * radius : Infinity;
  for (const [id, api] of bots) {
    if (id === excludeId || !api) continue;
    const pos = api.getPosition?.();
    if (!pos || !Number.isFinite(pos.x)) continue;
    const health = typeof api.health === 'number' ? api.health : 1;
    if (health <= 0) continue;
    if (r2 !== Infinity) {
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const dz = pos.z - cz;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
    }
    list.push({ id, x: pos.x, y: pos.y, z: pos.z });
  }
  return list;
};

/** Deliver a power-up to a bot so it gains a temporary buff (speed, etc.). */
export const deliverPowerUp = (id, category, rarity) => {
  const api = bots.get(id);
  if (api && typeof api.collectPowerUp === 'function') api.collectPowerUp(category, rarity);
};

