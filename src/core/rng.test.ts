import { describe, it, expect } from 'vitest';
import { makeRng, randomSeed } from './rng';

describe('makeRng', () => {
  // The invariant multiplayer depends on: every peer seeded identically must
  // build the identical track. If this breaks, riders desync on decorations.
  it('is deterministic — the same seed yields the same sequence', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('yields different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, makeRng(1));
    const b = Array.from({ length: 20 }, makeRng(2));
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('handles seed 0 and produces a varying sequence', () => {
    const rng = makeRng(0);
    const vals = Array.from({ length: 10 }, () => rng());
    expect(new Set(vals).size).toBeGreaterThan(1);
  });

  it('randomSeed returns a uint32', () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
