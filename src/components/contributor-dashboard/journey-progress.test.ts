import { describe, it, expect } from 'vitest';
import { levelProgressPct, journeyHeading, journeyFooter } from './journey-progress';

describe('journeyHeading', () => {
  it('shows the real next level when one exists', () => {
    expect(journeyHeading(3, 4)).toBe('L3 → L4 JOURNEY');
  });

  it('shows a MAX LEVEL state instead of a fake next level when next is null', () => {
    expect(journeyHeading(5, null)).toBe('L5 · MAX LEVEL');
  });

  it('handles the L0 boundary', () => {
    expect(journeyHeading(0, 1)).toBe('L0 → L1 JOURNEY');
  });
});

describe('journeyFooter', () => {
  it('shows remaining XP when a next level exists', () => {
    expect(journeyFooter(250, 4)).toBe('250 XP TO L4');
  });

  it('formats large XP amounts with a thousands separator', () => {
    expect(journeyFooter(1250, 5)).toBe('1,250 XP TO L5');
  });

  it('shows LEVEL CAP REACHED instead of "0 XP TO L6" when next is null', () => {
    expect(journeyFooter(0, null)).toBe('LEVEL CAP REACHED');
  });
});

describe('levelProgressPct', () => {
  it('is 0% at the exact floor of a level', () => {
    expect(levelProgressPct(100, 1)).toBe(0);
  });

  it('is 100% at the exact ceiling of a level', () => {
    expect(levelProgressPct(459, 1)).toBe(100);
  });

  it('computes partial progress correctly mid-level', () => {
    // L1 = 100, L2 = 459 -> halfway would be (100+459)/2 = 279.5
    expect(levelProgressPct(279, 1)).toBeCloseTo(49.86, 1);
  });

  it('is 100% once a user is at or past the max level threshold', () => {
    // L5 is the max level; xpForLevel(6) falls back to the same value as
    // xpForLevel(5), so ceiling <= floor and this should clamp to 100
    // instead of dividing by zero.
    expect(levelProgressPct(3404, 5)).toBe(100);
    expect(levelProgressPct(9999, 5)).toBe(100);
  });

  it('clamps below 0% instead of going negative for out-of-range input', () => {
    expect(levelProgressPct(0, 3)).toBe(0);
  });
});
