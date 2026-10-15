import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerBot,
  unregisterBot,
  getBotCandidates,
  getBotVelocity,
  damageBot,
  applyBotKnockback,
  getBotPositions,
  deliverPowerUp,
} from './botRegistry.js';

// botRegistry is module-level shared state, so every test registers fresh ids and
// tears them down. The fakes mirror the api shape BotPlayer.jsx registers:
//   { getPosition, getVelocity, health, takeDamage, applyKnockback, collectPowerUp }
const makeFake = (pos, health = 100, vel = { x: 0, z: 0 }) => ({
  getPosition: () => pos,
  getVelocity: () => vel,
  health,
  takeDamage: vi.fn(),
  applyKnockback: vi.fn(),
  collectPowerUp: vi.fn(),
});

afterEach(() => {
  unregisterBot('bot-0');
  unregisterBot('bot-1');
  unregisterBot('bot-2');
});

describe('botRegistry — candidate listing', () => {
  it('exposes living bots as target candidates (with velocity for impact)', () => {
    registerBot('bot-0', makeFake({ x: 1, y: 2, z: 3 }, 100, { x: 5, z: -2 }));
    registerBot('bot-1', makeFake({ x: 4, y: 5, z: 6 }));

    const list = getBotCandidates(null);

    expect(list).toHaveLength(2);
    expect(list).toEqual(
      expect.arrayContaining([
        { id: 'bot-0', kind: 'bot', x: 1, y: 2, z: 3, health: 100, vx: 5, vz: -2 },
        { id: 'bot-1', kind: 'bot', x: 4, y: 5, z: 6, health: 100, vx: 0, vz: 0 },
      ]),
    );
  });

  it('reports a single bot velocity, or null when unknown', () => {
    registerBot('bot-0', makeFake({ x: 0, y: 0, z: 0 }, 100, { x: 9, z: 3 }));

    expect(getBotVelocity('bot-0')).toEqual({ x: 9, z: 3 });
    expect(getBotVelocity('ghost')).toBeNull();
  });

  it('skips the excluded id and any downed bot (health <= 0)', () => {
    registerBot('bot-0', makeFake({ x: 0, y: 0, z: 0 }));
    registerBot('bot-1', makeFake({ x: 1, y: 0, z: 0 }, 0)); // downed

    const list = getBotCandidates('bot-0');

    expect(list).toHaveLength(0);
  });

  it('ignores bots that report a non-finite position', () => {
    registerBot('bot-0', makeFake({ x: NaN, y: 0, z: 0 }));

    expect(getBotCandidates(null)).toHaveLength(0);
  });
});

describe('botRegistry — combat hooks', () => {
  it('routes damage to the victim only', () => {
    const a = makeFake({ x: 0, y: 0, z: 0 });
    const b = makeFake({ x: 1, y: 0, z: 0 });
    registerBot('bot-0', a);
    registerBot('bot-1', b);

    damageBot('bot-1', 12, 'bot-0');

    expect(a.takeDamage).not.toHaveBeenCalled();
    expect(b.takeDamage).toHaveBeenCalledWith(12, 'bot-0');
  });

  it('routes knockback direction/force to the victim', () => {
    const b = makeFake({ x: 1, y: 0, z: 0 });
    registerBot('bot-1', b);

    applyBotKnockback('bot-1', { x: -1, y: 0, z: 0 }, 170);

    expect(b.applyKnockback).toHaveBeenCalledWith({ x: -1, y: 0, z: 0 }, 170);
  });

  it('is a safe no-op for an unknown id', () => {
    expect(() => damageBot('ghost', 12, 'bot-0')).not.toThrow();
    expect(() => applyBotKnockback('ghost', { x: 0, y: 0, z: 1 }, 170)).not.toThrow();
  });
});

describe('botRegistry — power-up proximity (getBotPositions)', () => {
  it('returns only living bots inside the radius', () => {
    registerBot('bot-0', makeFake({ x: 1, y: 0, z: 0 }));      // within 2.5
    registerBot('bot-1', makeFake({ x: 10, y: 0, z: 0 }));     // outside
    registerBot('bot-2', makeFake({ x: 1, y: 0, z: 0 }, 0));   // within but downed

    const near = getBotPositions(null, 0, 0, 0, 2.5);

    expect(near.map((b) => b.id)).toEqual(['bot-0']);
  });

  it('returns all living bots when no radius is given', () => {
    registerBot('bot-0', makeFake({ x: 1, y: 0, z: 0 }));
    registerBot('bot-1', makeFake({ x: 100, y: 0, z: 0 }));

    expect(getBotPositions(null)).toHaveLength(2);
  });
});

describe('botRegistry — power-up delivery', () => {
  it('hands the category + rarity to the closest living bot', () => {
    const a = makeFake({ x: 0.5, y: 0, z: 0 });
    const b = makeFake({ x: 0, y: 0, z: 0 });
    registerBot('bot-0', a);
    registerBot('bot-1', b);

    deliverPowerUp('bot-1', 'speed', 'gold');

    expect(a.collectPowerUp).not.toHaveBeenCalled();
    expect(b.collectPowerUp).toHaveBeenCalledWith('speed', 'gold');
  });

  it('is a safe no-op for an unknown id or a bot without the hook', () => {
    registerBot('bot-0', { getPosition: () => ({ x: 0, y: 0, z: 0 }), health: 100 });

    expect(() => deliverPowerUp('ghost', 'speed', 'gold')).not.toThrow();
    expect(() => deliverPowerUp('bot-0', 'speed', 'gold')).not.toThrow();
  });
});
