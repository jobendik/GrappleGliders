import { describe, expect, it } from 'vitest';
import { SeededRandom, makeDailySeed } from '../src/utils/seededRandom';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const aVals = Array.from({ length: 8 }, () => a.next());
    const bVals = Array.from({ length: 8 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('next() stays within [0, 1)', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() respects bounds', () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 200; i++) {
      const v = rng.range(-10, 5);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThan(5);
    }
  });

  it('int() returns integers in [min, max]', () => {
    const rng = new SeededRandom(99);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const v = rng.int(0, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('pick() picks deterministically', () => {
    const a = new SeededRandom(123);
    const b = new SeededRandom(123);
    const opts = ['x', 'y', 'z', 'w'];
    expect(a.pick(opts)).toBe(b.pick(opts));
  });

  it('reseed restores deterministic sequence', () => {
    const rng = new SeededRandom(11);
    const first = [rng.next(), rng.next(), rng.next()];
    rng.reseed(11);
    const second = [rng.next(), rng.next(), rng.next()];
    expect(first).toEqual(second);
  });
});

describe('makeDailySeed', () => {
  it('mixes the date and mode id deterministically', () => {
    const a = makeDailySeed(20260519, 'daily');
    const b = makeDailySeed(20260519, 'daily');
    expect(a).toBe(b);
    expect(a).not.toBe(makeDailySeed(20260519, 'endless'));
    expect(a).not.toBe(makeDailySeed(20260520, 'daily'));
  });
});
