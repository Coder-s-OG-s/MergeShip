import { describe, expect, it } from 'vitest';
import {
  bumpActivityDay,
  contributionCalendarToActivity,
  mergeActivityDays,
  totalContributions,
} from './activity-history';

describe('mergeActivityDays', () => {
  it('sums counts for the same date', () => {
    expect(
      mergeActivityDays([
        { date: '2026-06-01', count: 1 },
        { date: '2026-06-01', count: 2 },
        { date: '2026-06-02', count: 1 },
      ]),
    ).toEqual([
      { date: '2026-06-01', count: 3 },
      { date: '2026-06-02', count: 1 },
    ]);
  });
});

describe('contributionCalendarToActivity', () => {
  it('maps GitHub calendar rows to heatmap rows', () => {
    expect(
      contributionCalendarToActivity([
        { date: '2026-06-01', contributionCount: 4 },
        { date: '2026-06-02', contributionCount: 0 },
      ]),
    ).toEqual([{ date: '2026-06-01', count: 4 }]);
  });
});

describe('bumpActivityDay', () => {
  it('groups by UTC date prefix', () => {
    const map = new Map<string, number>();
    bumpActivityDay(map, '2026-06-15T18:07:04.702271+00:00');
    expect(map.get('2026-06-15')).toBe(1);
  });
});

describe('totalContributions', () => {
  it('sums day counts', () => {
    expect(
      totalContributions([
        { date: '2026-06-01', count: 2 },
        { date: '2026-06-02', count: 3 },
      ]),
    ).toBe(5);
  });
});
