import { describe, it, expect } from 'vitest';
import { calculateStreak, parsePRState } from './github-sync';

describe('calculateStreak', () => {
  const day = (date: string, count: number) => ({ date, contributionCount: count });

  it('returns 0 when no contributions', () => {
    const days = [day('2026-05-14', 0), day('2026-05-13', 0)];
    expect(calculateStreak(days, '2026-05-14')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const days = [
      day('2026-05-14', 3),
      day('2026-05-13', 1),
      day('2026-05-12', 2),
      day('2026-05-11', 0),
    ];
    expect(calculateStreak(days, '2026-05-14')).toBe(3);
  });

  it('skips today if zero contributions (streak from yesterday)', () => {
    const days = [
      day('2026-05-14', 0),
      day('2026-05-13', 5),
      day('2026-05-12', 2),
      day('2026-05-11', 0),
    ];
    expect(calculateStreak(days, '2026-05-14')).toBe(2);
  });

  it('returns 0 when yesterday is also zero', () => {
    const days = [day('2026-05-14', 0), day('2026-05-13', 0), day('2026-05-12', 5)];
    expect(calculateStreak(days, '2026-05-14')).toBe(0);
  });

  it('handles single day with contributions', () => {
    const days = [day('2026-05-14', 1)];
    expect(calculateStreak(days, '2026-05-14')).toBe(1);
  });
});

describe('parsePRState', () => {
  it('returns merged when merged_at is set', () => {
    expect(parsePRState('closed', '2026-05-01T00:00:00Z')).toBe('merged');
  });

  it('returns open when state is open and not merged', () => {
    expect(parsePRState('open', null)).toBe('open');
  });

  it('returns closed when state is closed and not merged', () => {
    expect(parsePRState('closed', null)).toBe('closed');
  });
});
