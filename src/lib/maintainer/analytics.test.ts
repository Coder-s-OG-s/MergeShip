import { describe, expect, it } from 'vitest';
import { buildDayOverDayStats, buildMaintainerAnalyticsTrends } from './analytics';

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
