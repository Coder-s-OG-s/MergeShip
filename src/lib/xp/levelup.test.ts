import { describe, it, expect } from 'vitest';
import { detectLevelUp } from './levelup';

describe('detectLevelUp', () => {
  it('no change when xp gain stays in same level', () => {
    expect(detectLevelUp({ xpBefore: 50, xpAfter: 80 })).toEqual({ leveledUp: false });
  });

  it('single-level jump', () => {
    const r = detectLevelUp({ xpBefore: 50, xpAfter: 150 });
    expect(r.leveledUp).toBe(true);
    if (r.leveledUp) {
      expect(r.from).toBe(0);
      expect(r.to).toBe(1);
    }
  });

  it('multi-level jump in one event', () => {
    const r = detectLevelUp({ xpBefore: 0, xpAfter: 1200 });
    expect(r.leveledUp).toBe(true);
    if (r.leveledUp) {
      expect(r.from).toBe(0);
      expect(r.to).toBe(3);
    }
  });

  it('exact threshold counts as level up', () => {
    const r = detectLevelUp({ xpBefore: 99, xpAfter: 100 });
    expect(r.leveledUp).toBe(true);
    if (r.leveledUp) expect(r.to).toBe(1);
  });

  it('no change when xp decreased', () => {
    expect(detectLevelUp({ xpBefore: 200, xpAfter: 50 })).toEqual({ leveledUp: false });
  });
});
