import { describe, expect, it } from 'vitest';
import {
  buildCurrentLevelSnapshot,
  buildDayOverDayStats,
  buildMaintainerAnalyticsTrends,
  buildPrVolumeTimeSeries,
} from './analytics';

describe('buildMaintainerAnalyticsTrends', () => {
  it('groups merged PRs and completed XP into the last twelve UTC weeks', () => {
    const trends = buildMaintainerAnalyticsTrends({
      now: new Date('2026-05-21T12:00:00.000Z'),
      mergedPullRequests: [
        { mergedAt: '2026-05-18T08:00:00.000Z' },
        { mergedAt: '2026-05-20T08:00:00.000Z' },
        { mergedAt: '2026-05-11T08:00:00.000Z' },
      ],
      completedRecommendations: [
        { completedAt: '2026-05-20T09:00:00.000Z', xpReward: 150 },
        { completedAt: '2026-05-12T09:00:00.000Z', xpReward: 80 },
      ],
      contributorProfiles: [],
      levelUps: [],
    });

    expect(trends.weekly.at(-1)).toMatchObject({
      weekStart: '2026-05-18',
      mergedPrs: 2,
      xpDistributed: 150,
    });
    expect(trends.weekly.at(-2)).toMatchObject({
      weekStart: '2026-05-11',
      mergedPrs: 1,
      xpDistributed: 80,
    });
  });

  it('reconstructs monthly level snapshots from current levels and level-up events', () => {
    const trends = buildMaintainerAnalyticsTrends({
      now: new Date('2026-05-21T12:00:00.000Z'),
      mergedPullRequests: [],
      completedRecommendations: [],
      contributorProfiles: [
        { id: 'u1', level: 3, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'u2', level: 1, createdAt: '2026-04-10T00:00:00.000Z' },
      ],
      levelUps: [
        {
          userId: 'u1',
          fromLevel: 2,
          toLevel: 3,
          occurredAt: '2026-05-05T00:00:00.000Z',
        },
        {
          userId: 'u1',
          fromLevel: 1,
          toLevel: 2,
          occurredAt: '2026-03-05T00:00:00.000Z',
        },
      ],
    });

    expect(trends.levelDistribution.find((row) => row.monthStart === '2026-03-01')).toMatchObject({
      l2: 1,
      l3Plus: 0,
    });
    expect(trends.levelDistribution.at(-1)).toMatchObject({
      monthStart: '2026-05-01',
      l1: 1,
      l3Plus: 1,
    });
  });

  it('passes through avgReviewTimeHours when provided', () => {
    const trends = buildMaintainerAnalyticsTrends({
      now: new Date('2026-05-21T12:00:00.000Z'),
      mergedPullRequests: [],
      completedRecommendations: [],
      contributorProfiles: [],
      levelUps: [],
      avgReviewTimeHours: 1.8,
    });

    expect(trends.avgReviewTimeHours).toBe(1.8);
  });

  it('builds day-over-day deltas from UTC PR timestamps', () => {
    const stats = buildDayOverDayStats(new Date('2026-05-21T12:00:00.000Z'), [
      {
        githubCreatedAt: '2026-05-21T02:00:00.000Z',
        mergedAt: '2026-05-21T03:00:00.000Z',
        mentorReviewAt: '2026-05-21T06:00:00.000Z',
      },
      {
        githubCreatedAt: '2026-05-21T08:00:00.000Z',
        mergedAt: '2026-05-21T09:00:00.000Z',
        mentorReviewAt: '2026-05-21T10:00:00.000Z',
      },
      {
        githubCreatedAt: '2026-05-20T04:00:00.000Z',
        mergedAt: '2026-05-20T05:00:00.000Z',
        mentorReviewAt: '2026-05-20T06:00:00.000Z',
      },
    ]);

    expect(stats.openedPrs).toMatchObject({
      current: 2,
      previous: 1,
      delta: 1,
      direction: 'up',
    });
    expect(stats.avgReviewTimeHours).toMatchObject({
      current: 3,
      previous: 2,
      delta: 1,
      direction: 'up',
    });
  });

  it('builds day-over-day deltas from UTC PR timestamps', () => {
    const trends = buildMaintainerAnalyticsTrends({
      now: new Date('2026-05-21T12:00:00.000Z'),
      mergedPullRequests: [
        {
          githubCreatedAt: '2026-05-21T02:00:00.000Z',
          mergedAt: '2026-05-21T03:00:00.000Z',
          mentorReviewAt: '2026-05-21T06:00:00.000Z',
        },
        {
          githubCreatedAt: '2026-05-21T08:00:00.000Z',
          mergedAt: '2026-05-21T09:00:00.000Z',
          mentorReviewAt: '2026-05-21T10:00:00.000Z',
        },
        {
          githubCreatedAt: '2026-05-20T04:00:00.000Z',
          mergedAt: '2026-05-20T05:00:00.000Z',
          mentorReviewAt: '2026-05-20T06:00:00.000Z',
        },
      ],
      completedRecommendations: [],
      contributorProfiles: [],
      levelUps: [],
    });

    expect(trends.dayOverDay.openedPrs).toMatchObject({
      current: 2,
      previous: 1,
      delta: 1,
      direction: 'up',
    });
    expect(trends.dayOverDay.mergedPrs).toMatchObject({
      current: 2,
      previous: 1,
      delta: 1,
    });
    expect(trends.dayOverDay.mentorReviews).toMatchObject({
      current: 2,
      previous: 1,
      delta: 1,
    });
    expect(trends.dayOverDay.avgReviewTimeHours).toMatchObject({
      current: 3,
      previous: 2,
      delta: 1,
      direction: 'up',
    });
  });

  it('marks average review time delta as flat when either day has no reviews', () => {
    const trends = buildMaintainerAnalyticsTrends({
      now: new Date('2026-05-21T12:00:00.000Z'),
      mergedPullRequests: [
        {
          githubCreatedAt: '2026-05-21T02:00:00.000Z',
          mergedAt: null,
          mentorReviewAt: '2026-05-21T06:00:00.000Z',
        },
      ],
      completedRecommendations: [],
      contributorProfiles: [],
      levelUps: [],
    });

    expect(trends.dayOverDay.avgReviewTimeHours).toMatchObject({
      current: 4,
      previous: null,
      delta: null,
      direction: 'flat',
    });
  });
});

describe('buildCurrentLevelSnapshot', () => {
  it('correctly counts level buckets', () => {
    const list = [
      { level: 0 },
      { level: 1 },
      { level: 1 },
      { level: 2 },
      { level: 3 },
      { level: 4 },
      { level: -1 },
    ];
    const snapshot = buildCurrentLevelSnapshot(list);
    expect(snapshot).toEqual({
      l0: 2,
      l1: 2,
      l2: 1,
      l3Plus: 2,
    });
  });

  it('handles empty lists gracefully', () => {
    const snapshot = buildCurrentLevelSnapshot([]);
    expect(snapshot).toEqual({
      l0: 0,
      l1: 0,
      l2: 0,
      l3Plus: 0,
    });
  });
});

describe('buildPrVolumeTimeSeries', () => {
  const makePr = (
    overrides: Partial<{
      github_created_at: string;
      merged_at: string | null;
      closed_at: string | null;
      ai_flagged: boolean;
      state: string;
    }> = {},
  ) => ({
    github_created_at: '2026-07-10T12:00:00.000Z',
    merged_at: null as string | null,
    closed_at: null as string | null,
    ai_flagged: false,
    state: 'open',
    ...overrides,
  });

  it('creates daily buckets for 7d range', () => {
    const from = new Date('2026-07-08T00:00:00.000Z');
    const to = new Date('2026-07-15T00:00:00.000Z');
    const prs = [
      makePr({ github_created_at: '2026-07-10T12:00:00.000Z' }),
      makePr({ github_created_at: '2026-07-10T18:00:00.000Z' }),
      makePr({
        github_created_at: '2026-07-12T09:00:00.000Z',
        merged_at: '2026-07-13T10:00:00.000Z',
      }),
    ];

    const result = buildPrVolumeTimeSeries(prs, from, to, '7d');

    expect(result).toHaveLength(7);
    const jul10 = result.find((r) => r.date === '2026-07-10');
    expect(jul10).toMatchObject({ opened: 2, merged: 0, closed: 0, aiBlocked: 0 });
    const jul12 = result.find((r) => r.date === '2026-07-12');
    expect(jul12).toMatchObject({ opened: 1, merged: 1, closed: 0, aiBlocked: 0 });
  });

  it('counts merged PRs separately from closed', () => {
    const from = new Date('2026-07-08T00:00:00.000Z');
    const to = new Date('2026-07-15T00:00:00.000Z');
    const prs = [
      makePr({
        github_created_at: '2026-07-10T12:00:00.000Z',
        merged_at: '2026-07-11T10:00:00.000Z',
      }),
      makePr({
        github_created_at: '2026-07-10T14:00:00.000Z',
        state: 'closed',
        closed_at: '2026-07-11T11:00:00.000Z',
      }),
    ];

    const result = buildPrVolumeTimeSeries(prs, from, to, '7d');

    const jul10 = result.find((r) => r.date === '2026-07-10');
    expect(jul10).toMatchObject({ opened: 2, merged: 1, closed: 1 });
  });

  it('counts AI blocked PRs', () => {
    const from = new Date('2026-07-08T00:00:00.000Z');
    const to = new Date('2026-07-15T00:00:00.000Z');
    const prs = [
      makePr({
        github_created_at: '2026-07-10T12:00:00.000Z',
        ai_flagged: true,
        state: 'closed',
        closed_at: '2026-07-10T10:00:00.000Z',
      }),
      makePr({ github_created_at: '2026-07-10T14:00:00.000Z', ai_flagged: false }),
    ];

    const result = buildPrVolumeTimeSeries(prs, from, to, '7d');

    const jul10 = result.find((r) => r.date === '2026-07-10');
    expect(jul10).toMatchObject({ opened: 2, aiBlocked: 1 });
  });

  it('creates weekly buckets for 90d range', () => {
    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-07-15T00:00:00.000Z');
    const prs = [
      makePr({ github_created_at: '2026-07-07T12:00:00.000Z' }),
      makePr({ github_created_at: '2026-07-14T12:00:00.000Z' }),
    ];

    const result = buildPrVolumeTimeSeries(prs, from, to, '90d');

    // July 7 is Tuesday → week start is July 5
    const jul5 = result.find((r) => r.date === '2026-07-05');
    expect(jul5).toMatchObject({ opened: 1 });
    // July 14 is Tuesday → week start is July 12
    const jul12 = result.find((r) => r.date === '2026-07-12');
    expect(jul12).toMatchObject({ opened: 1 });
  });

  it('returns empty array when no PRs exist', () => {
    const from = new Date('2026-07-08T00:00:00.000Z');
    const to = new Date('2026-07-09T00:00:00.000Z');

    const result = buildPrVolumeTimeSeries([], from, to, '7d');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ opened: 0, merged: 0, closed: 0, aiBlocked: 0 });
  });

  it('sorts results by date ascending', () => {
    const from = new Date('2026-07-08T00:00:00.000Z');
    const to = new Date('2026-07-12T00:00:00.000Z');
    const prs = [
      makePr({ github_created_at: '2026-07-11T12:00:00.000Z' }),
      makePr({ github_created_at: '2026-07-09T12:00:00.000Z' }),
    ];

    const result = buildPrVolumeTimeSeries(prs, from, to, '7d');

    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.date >= result[i - 1]!.date).toBe(true);
    }
  });
});
