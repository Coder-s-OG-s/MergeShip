import { describe, it, expect } from 'vitest';
import { mixForLevel, filterAndRank, type ScoredIssue } from './recommend';

const issue = (over: Partial<ScoredIssue>): ScoredIssue => ({
  id: 1,
  repoFullName: 'a/b',
  number: 1,
  title: 't',
  difficulty: 'M',
  xpReward: 150,
  repoHealthScore: 60,
  freshnessHours: 24,
  languageMatch: false,
  ...over,
});

describe('mixForLevel', () => {
  it('L0 gets 3 E recs', () => {
    expect(mixForLevel(0)).toEqual({ E: 3, M: 0, H: 0 });
  });
  it('L1 gets 2 E + 2 M', () => {
    expect(mixForLevel(1)).toEqual({ E: 2, M: 2, H: 0 });
  });
  it('L2 gets 1 E + 2 M + 2 H', () => {
    expect(mixForLevel(2)).toEqual({ E: 1, M: 2, H: 2 });
  });
  it('L3 gets 2 M + 3 H', () => {
    expect(mixForLevel(3)).toEqual({ E: 0, M: 2, H: 3 });
  });
  it('L4+ gets 1 M + 4 H', () => {
    expect(mixForLevel(4)).toEqual({ E: 0, M: 1, H: 4 });
    expect(mixForLevel(99)).toEqual({ E: 0, M: 1, H: 4 });
  });
});

describe('filterAndRank', () => {
  it('excludes repos below repo_health 40', () => {
    const issues = [
      issue({ id: 1, repoHealthScore: 35, difficulty: 'E' }),
      issue({ id: 2, repoHealthScore: 80, difficulty: 'E' }),
    ];
    const result = filterAndRank(issues, { level: 0, excludeIssueIds: new Set() });
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it('respects level mix — L0 only gets E', () => {
    const issues = [
      issue({ id: 1, difficulty: 'E' }),
      issue({ id: 2, difficulty: 'M' }),
      issue({ id: 3, difficulty: 'H' }),
      issue({ id: 4, difficulty: 'E' }),
      issue({ id: 5, difficulty: 'E' }),
    ];
    const result = filterAndRank(issues, { level: 0, excludeIssueIds: new Set() });
    expect(result.every((r) => r.difficulty === 'E')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('respects level mix — L2 returns 1E+2M+2H', () => {
    const issues = [
      ...Array.from({ length: 5 }).map((_, i) => issue({ id: 100 + i, difficulty: 'E' })),
      ...Array.from({ length: 5 }).map((_, i) => issue({ id: 200 + i, difficulty: 'M' })),
      ...Array.from({ length: 5 }).map((_, i) => issue({ id: 300 + i, difficulty: 'H' })),
    ];
    const result = filterAndRank(issues, { level: 2, excludeIssueIds: new Set() });
    const tally = result.reduce<Record<string, number>>((acc, r) => {
      acc[r.difficulty] = (acc[r.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    expect(tally).toEqual({ E: 1, M: 2, H: 2 });
  });

  it('excludes already-seen issue ids', () => {
    const issues = [
      issue({ id: 1, difficulty: 'E' }),
      issue({ id: 2, difficulty: 'E' }),
      issue({ id: 3, difficulty: 'E' }),
    ];
    const result = filterAndRank(issues, { level: 0, excludeIssueIds: new Set([1, 3]) });
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it('prefers higher repo_health within a tier', () => {
    const issues = [
      issue({ id: 1, difficulty: 'E', repoHealthScore: 50 }),
      issue({ id: 2, difficulty: 'E', repoHealthScore: 90 }),
      issue({ id: 3, difficulty: 'E', repoHealthScore: 70 }),
    ];
    const result = filterAndRank(issues, { level: 0, excludeIssueIds: new Set() });
    expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('boosts language match within ranking', () => {
    const issues = [
      issue({ id: 1, difficulty: 'E', repoHealthScore: 80, languageMatch: false }),
      issue({ id: 2, difficulty: 'E', repoHealthScore: 80, languageMatch: true }),
    ];
    const result = filterAndRank(issues, { level: 0, excludeIssueIds: new Set() });
    expect(result[0]?.id).toBe(2);
  });

  it('handles empty pool gracefully', () => {
    const result = filterAndRank([], { level: 0, excludeIssueIds: new Set() });
    expect(result).toEqual([]);
  });

  it('falls back to easier tier when target tier is empty', () => {
    const issues = [issue({ id: 1, difficulty: 'M' }), issue({ id: 2, difficulty: 'M' })];
    // L0 wants 3 E but pool has none. Soft fallback: take M's so user has something.
    const result = filterAndRank(issues, {
      level: 0,
      excludeIssueIds: new Set(),
      allowFallback: true,
    });
    expect(result).toHaveLength(2);
  });

  it('without fallback returns empty when tier is missing', () => {
    const issues = [issue({ id: 1, difficulty: 'M' })];
    const result = filterAndRank(issues, {
      level: 0,
      excludeIssueIds: new Set(),
      allowFallback: false,
    });
    expect(result).toEqual([]);
  });
});
