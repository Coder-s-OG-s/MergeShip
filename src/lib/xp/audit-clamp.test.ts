import { describe, it, expect } from 'vitest';
import { clampAuditScoreToLevel } from './audit-clamp';
import { xpForLevel, levelForXp } from './curve';

const L2_THRESHOLD = xpForLevel(2);
const L3_THRESHOLD = xpForLevel(3);

describe('clampAuditScoreToLevel', () => {
  it('passes through scores that land at L0', () => {
    expect(clampAuditScoreToLevel(0, 2)).toBe(0);
    expect(clampAuditScoreToLevel(50, 2)).toBe(50);
  });

  it('passes through scores that land at L1 (cap is L2)', () => {
    expect(clampAuditScoreToLevel(100, 2)).toBe(100);
    expect(clampAuditScoreToLevel(L2_THRESHOLD - 1, 2)).toBe(L2_THRESHOLD - 1);
  });

  it('allows landing exactly at L2', () => {
    expect(clampAuditScoreToLevel(L2_THRESHOLD, 2)).toBe(L2_THRESHOLD);
  });

  it('clamps anything that would push past L2 down to the L3 threshold minus one', () => {
    expect(clampAuditScoreToLevel(L3_THRESHOLD, 2)).toBe(L3_THRESHOLD - 1);
    expect(clampAuditScoreToLevel(L3_THRESHOLD + 500, 2)).toBe(L3_THRESHOLD - 1);
    expect(clampAuditScoreToLevel(1580, 2)).toBe(L3_THRESHOLD - 1);
  });

  it('clamped value lands at exactly the max-level (L2)', () => {
    const clamped = clampAuditScoreToLevel(99_999, 2);
    expect(levelForXp(clamped)).toBe(2);
  });

  it('honours a different max level (defence in depth)', () => {
    expect(clampAuditScoreToLevel(99_999, 1)).toBe(L2_THRESHOLD - 1);
    expect(levelForXp(clampAuditScoreToLevel(99_999, 1))).toBe(1);
  });

  it('floors negatives at zero', () => {
    expect(clampAuditScoreToLevel(-50, 2)).toBe(0);
  });
});
