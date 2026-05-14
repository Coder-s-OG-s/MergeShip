import { describe, it, expect } from 'vitest';
import { computeCurrentStreak } from './streak';

const day = (n: number, source = 'streak'): { source: string; created_at: string } => {
  const d = new Date('2026-05-14T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return { source, created_at: d.toISOString() };
};

describe('computeCurrentStreak', () => {
  const today = '2026-05-14';

  it('empty events → 0', () => {
    expect(computeCurrentStreak([], today)).toBe(0);
  });

  it('one event today → 1', () => {
    expect(computeCurrentStreak([day(0)], today)).toBe(1);
  });

  it('consecutive 5 days including today → 5', () => {
    expect(computeCurrentStreak([day(0), day(1), day(2), day(3), day(4)], today)).toBe(5);
  });

  it('starts yesterday and runs back → counts from yesterday', () => {
    expect(computeCurrentStreak([day(1), day(2), day(3)], today)).toBe(3);
  });

  it('gap of more than 1 day breaks streak', () => {
    expect(computeCurrentStreak([day(0), day(1), day(3), day(4)], today)).toBe(2);
  });

  it('events older than 2 days with nothing recent → 0', () => {
    expect(computeCurrentStreak([day(5), day(6), day(7)], today)).toBe(0);
  });

  it('multiple events same day counted once', () => {
    expect(computeCurrentStreak([day(0), day(0, 'recommended_merge'), day(1)], today)).toBe(2);
  });

  it('ignores future dates', () => {
    const future = day(-2);
    expect(computeCurrentStreak([day(0), future], today)).toBe(1);
  });
});
