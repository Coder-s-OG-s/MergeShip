import { describe, expect, it } from 'vitest';
import { buildMaintainerAnalytics } from './analytics';

const now = new Date('2026-05-18T12:00:00Z');

describe('buildMaintainerAnalytics', () => {
  it('groups merged PRs and completed XP into weekly buckets', () => {
    const analytics = buildMaintainerAnalytics({
      now,
      prs: [
        {
          id: 1,
          state: 'merged',
          authorUserId: 'u1',
          githubCreatedAt: '2026-05-10T00:00:00Z',
          githubUpdatedAt: '2026-05-14T00:00:00Z',
          mergedAt: '2026-05-14T00:00:00Z',
        },
        {
          id: 2,
          state: 'merged',
          authorUserId: 'u2',
          githubCreatedAt: '2026-05-15T00:00:00Z',
          githubUpdatedAt: '2026-05-16T00:00:00Z',
          mergedAt: '2026-05-16T00:00:00Z',
        },
        {
          id: 3,
          state: 'open',
          authorUserId: 'u3',
          githubCreatedAt: '2026-05-16T00:00:00Z',
          githubUpdatedAt: '2026-05-17T00:00:00Z',
          mergedAt: null,
        },
      ],
      recommendations: [
        { xpReward: 40, completedAt: '2026-05-14T00:00:00Z' },
        { xpReward: 60, completedAt: '2026-05-16T00:00:00Z' },
      ],
      profiles: [],
    });

    expect(analytics.totals.mergedPrs12w).toBe(2);
    expect(analytics.totals.xpDistributed12w).toBe(100);
    expect(analytics.totals.activeContributors12w).toBe(3);
    expect(analytics.weekly.at(-1)).toMatchObject({ mergedPrs: 2, xpDistributed: 100 });
  });

  it('ignores records outside the 12 week window', () => {
    const analytics = buildMaintainerAnalytics({
      now,
      prs: [
        {
          id: 1,
          state: 'merged',
          authorUserId: 'old',
          githubCreatedAt: '2025-01-01T00:00:00Z',
          githubUpdatedAt: '2025-01-01T00:00:00Z',
          mergedAt: '2025-01-01T00:00:00Z',
        },
      ],
      recommendations: [{ xpReward: 999, completedAt: '2025-01-01T00:00:00Z' }],
      profiles: [],
    });

    expect(analytics.totals).toMatchObject({
      mergedPrs12w: 0,
      xpDistributed12w: 0,
      activeContributors12w: 0,
      mergeRatePerWeek: 0,
    });
  });

  it('builds monthly contributor level distribution from profile cohorts', () => {
    const analytics = buildMaintainerAnalytics({
      now,
      prs: [],
      recommendations: [],
      profiles: [
        { id: 'a', level: 0, createdAt: '2026-01-10T00:00:00Z' },
        { id: 'b', level: 1, createdAt: '2026-03-10T00:00:00Z' },
        { id: 'c', level: 2, createdAt: '2026-04-10T00:00:00Z' },
        { id: 'd', level: 4, createdAt: '2026-05-10T00:00:00Z' },
      ],
    });

    expect(analytics.levelDistribution).toHaveLength(6);
    expect(analytics.levelDistribution.at(-1)).toMatchObject({
      l0: 1,
      l1: 1,
      l2: 1,
      l3Plus: 1,
    });
  });
});
