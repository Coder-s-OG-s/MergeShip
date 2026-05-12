import { describe, it, expect } from 'vitest';
import { xpForLevel, levelForXp, xpToNextLevel, MAX_LEVEL } from './curve';

describe('xpForLevel', () => {
  it('L0 = 0', () => expect(xpForLevel(0)).toBe(0));
  it('L1 = 100', () => expect(xpForLevel(1)).toBe(100));
  it('L2 = 459', () => expect(xpForLevel(2)).toBe(459));
  it('L3 = 1119', () => expect(xpForLevel(3)).toBe(1119));
  it('L4 = 2089', () => expect(xpForLevel(4)).toBe(2089));
  it('L5 = 3404', () => expect(xpForLevel(5)).toBe(3404));

  it('monotonic increasing', () => {
    for (let i = 0; i < MAX_LEVEL; i++) {
      expect(xpForLevel(i + 1)).toBeGreaterThan(xpForLevel(i));
    }
  });

  it('throws on negative or non-integer level', () => {
    expect(() => xpForLevel(-1)).toThrow();
    expect(() => xpForLevel(1.5)).toThrow();
  });
});

describe('levelForXp', () => {
  it('0 xp -> L0', () => expect(levelForXp(0)).toBe(0));
  it('99 xp -> L0', () => expect(levelForXp(99)).toBe(0));
  it('100 xp -> L1', () => expect(levelForXp(100)).toBe(1));
  it('458 xp -> L1', () => expect(levelForXp(458)).toBe(1));
  it('459 xp -> L2', () => expect(levelForXp(459)).toBe(2));
  it('1118 xp -> L2', () => expect(levelForXp(1118)).toBe(2));
  it('1119 xp -> L3', () => expect(levelForXp(1119)).toBe(3));
  it('2089 xp -> L4', () => expect(levelForXp(2089)).toBe(4));
  it('3404 xp -> L5', () => expect(levelForXp(3404)).toBe(5));
  it('100000 xp -> capped at MAX_LEVEL', () => expect(levelForXp(100000)).toBe(MAX_LEVEL));

  it('negative xp clamps to 0', () => expect(levelForXp(-50)).toBe(0));
});

describe('xpToNextLevel', () => {
  it('at 0 xp, needs 100 to reach L1', () => {
    expect(xpToNextLevel(0)).toEqual({ next: 1, needed: 100 });
  });
  it('at 50 xp, needs 50 more for L1', () => {
    expect(xpToNextLevel(50)).toEqual({ next: 1, needed: 50 });
  });
  it('at 100 xp, needs 359 for L2', () => {
    expect(xpToNextLevel(100)).toEqual({ next: 2, needed: 359 });
  });
  it('at MAX_LEVEL xp returns null next', () => {
    const huge = xpForLevel(MAX_LEVEL);
    expect(xpToNextLevel(huge).next).toBeNull();
  });
});
