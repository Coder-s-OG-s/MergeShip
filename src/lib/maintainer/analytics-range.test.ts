import { describe, it, expect } from 'vitest';
import { parseRange, rangeToDateBounds, type AnalyticsRange } from './analytics-range';

const NOW = new Date('2026-03-15T12:00:00.000Z');

// Calendar-day difference in UTC, immune to DST shifts in the test runner's timezone.
function utcDayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

describe('parseRange', () => {
  it.each(['7d', '30d', '90d', 'all'] as const)('passes through valid range %s', (raw) => {
    expect(parseRange(raw)).toBe(raw);
  });

  it('defaults to 30d for undefined', () => {
    expect(parseRange(undefined)).toBe('30d');
  });

  it.each(['', '7', '60d', 'ALL', ' 30d', '30d ', 'week'])(
    'defaults to 30d for invalid input %s',
    (raw) => {
      expect(parseRange(raw)).toBe('30d');
    },
  );
});

describe('rangeToDateBounds', () => {
  const cases: { range: AnalyticsRange; daysBack: number }[] = [
    { range: '7d', daysBack: 7 },
    { range: '30d', daysBack: 30 },
    { range: '90d', daysBack: 90 },
  ];

  it.each(cases)('$range spans $daysBack days ending at now', ({ range, daysBack }) => {
    const { from, to } = rangeToDateBounds(range, NOW);
    expect(to.getTime()).toBe(NOW.getTime());
    expect(utcDayDiff(from, to)).toBe(daysBack);
  });

  it('all starts at 2000-01-01 and ends at now', () => {
    const { from, to } = rangeToDateBounds('all', NOW);
    expect(to.getTime()).toBe(NOW.getTime());
    expect(from.getUTCFullYear()).toBe(2000);
    expect(from.getUTCMonth()).toBe(0);
    expect(from.getUTCDate()).toBe(1);
  });

  it('does not mutate the passed now date', () => {
    const now = new Date(NOW.getTime());
    rangeToDateBounds('7d', now);
    expect(now.getTime()).toBe(NOW.getTime());
  });

  it('returns fresh Date instances on each call', () => {
    const a = rangeToDateBounds('30d', NOW);
    const b = rangeToDateBounds('30d', NOW);
    expect(a.from).not.toBe(b.from);
    expect(a.to).not.toBe(b.to);
    expect(a.from.getTime()).toBe(b.from.getTime());
  });

  it('handles month boundaries when subtracting days', () => {
    // Mar 5 minus 7 days lands in February
    const now = new Date('2026-03-05T12:00:00.000Z');
    const { from } = rangeToDateBounds('7d', now);
    expect(from.getUTCFullYear()).toBe(2026);
    expect(from.getUTCMonth()).toBe(1);
    expect(from.getUTCDate()).toBe(26);
  });
});
