import { describe, it, expect } from 'vitest';
import { encode, decode } from 'msgpackr';

/**
 * Phase B: WS Binary Migration — Batch B2
 * Tests that the binary protocol encodes/decodes correctly.
 * Failure mode: binary encoding/decoding produces corrupted data.
 */
describe('Binary Network Protocol', () => {
  it('msgpackr encodes and decodes a player snapshot', () => {
    const payload = {
      p: [
        {
          id: 'p1',
          pos: [0, 2.5, 0],
          vel: [0, 0, 0],
          rot: 0,
          skin: 'avo',
          anim: { jp: 'none', sl: false, mv: false },
          tick: 42,
          lastProcessedSeq: 7,
          groundY: 0,
        },
      ],
      t: 100,
    };

    const encoded = encode(payload);
    const decoded = decode(encoded);

    expect(decoded.p[0].id).toBe('p1');
    expect(decoded.p[0].pos[0]).toBe(0);
    expect(decoded.p[0].pos[1]).toBe(2.5);
    expect(decoded.p[0].vel[0]).toBe(0);
    expect(decoded.p[0].rot).toBe(0);
    expect(decoded.p[0].skin).toBe('avo');
    expect(decoded.p[0].tick).toBe(42);
    expect(decoded.p[0].lastProcessedSeq).toBe(7);
    expect(decoded.p[0].groundY).toBe(0);
    expect(decoded.t).toBe(100);
  });

  it('msgpackr encodes and decodes an input message', () => {
    const payload = {
      type: 'input',
      playerId: 'p1',
      input: { w: true, a: false, s: false, d: true, jump: true, walk: false, dash: false, slide: false },
      camRot: 1.57,
      tick: 43,
      sequenceId: 5,
    };

    const encoded = encode(payload);
    const decoded = decode(encoded);

    expect(decoded.type).toBe('input');
    expect(decoded.playerId).toBe('p1');
    expect(decoded.input.w).toBe(true);
    expect(decoded.input.d).toBe(true);
    expect(decoded.input.jump).toBe(true);
    expect(decoded.camRot).toBe(1.57);
    expect(decoded.tick).toBe(43);
    expect(decoded.sequenceId).toBe(5);
  });

  it('binary encoding is smaller than JSON', () => {
    const payload = {
      p: [
        {
          id: 'p1',
          pos: [0, 2.5, 0],
          vel: [0, 0, 0],
          rot: 0,
          skin: 'avo',
          anim: { jp: 'none', sl: false, mv: false },
          tick: 42,
          lastProcessedSeq: 7,
          groundY: 0,
        },
      ],
      t: 100,
    };

    const jsonSize = Buffer.byteLength(JSON.stringify(payload));
    const binarySize = encode(payload).length;

    expect(binarySize).toBeLessThan(jsonSize);
  });
});