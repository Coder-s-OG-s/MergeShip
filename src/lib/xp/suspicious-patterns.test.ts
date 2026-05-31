import { describe, expect, it } from 'vitest';
import {
  detectDailyXpEventSpikes,
  detectRapidMergeSpikes,
  detectReviewerApprovalConcentration,
  type SuspiciousMergedPr,
  type SuspiciousReview,
  type SuspiciousXpEvent,
} from './suspicious-patterns';

const userId = '00000000-0000-0000-0000-000000000001';
const reviewerId = '00000000-0000-0000-0000-000000000002';

describe('detectDailyXpEventSpikes', () => {
  it('flags users with more than five XP events in a UTC day', () => {
    const events: SuspiciousXpEvent[] = Array.from({ length: 6 }, (_, index) => ({
      userId,
      source: 'merge',
      refId: `pr:${index}`,
      repo: 'org/repo',
      xpDelta: 10,
      createdAt: `2026-05-19T0${index}:00:00Z`,
    }));

    const flags = detectDailyXpEventSpikes(events, {
      dayStart: '2026-05-19T00:00:00.000Z',
      dayEnd: '2026-05-20T00:00:00.000Z',
    });

    expect(flags).toHaveLength(1);
    expect(flags[0]?.reason).toBe('daily_xp_event_spike');
    expect(flags[0]?.evidence.count).toBe(6);
  });

  it('does not flag exactly five events', () => {
    const events: SuspiciousXpEvent[] = Array.from({ length: 5 }, (_, index) => ({
      userId,
      source: 'merge',
      refId: `pr:${index}`,
      repo: 'org/repo',
      xpDelta: 10,
      createdAt: `2026-05-19T0${index}:00:00Z`,
    }));

    expect(
      detectDailyXpEventSpikes(events, {
        dayStart: '2026-05-19T00:00:00.000Z',
        dayEnd: '2026-05-20T00:00:00.000Z',
      }),
    ).toHaveLength(0);
  });
});

describe('detectRapidMergeSpikes', () => {
  it('flags more than three merged PRs inside one hour', () => {
    const prs: SuspiciousMergedPr[] = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      repoFullName: 'org/repo',
      number: index + 10,
      title: `PR ${index}`,
      authorLogin: 'contributor',
      authorUserId: userId,
      mergedAt: `2026-05-19T10:${String(index * 10).padStart(2, '0')}:00Z`,
    }));

    const flags = detectRapidMergeSpikes(prs, {
      dayStart: '2026-05-19T00:00:00.000Z',
      dayEnd: '2026-05-20T00:00:00.000Z',
    });

    expect(flags).toHaveLength(1);
    expect(flags[0]?.reason).toBe('rapid_merge_spike');
  });
});

describe('detectReviewerApprovalConcentration', () => {
  it('flags more than four approvals from one reviewer to one contributor in a week', () => {
    const prs = new Map<number, SuspiciousMergedPr>(
      Array.from({ length: 5 }, (_, index) => [
        index + 1,
        {
          id: index + 1,
          repoFullName: 'org/repo',
          number: index + 20,
          title: `PR ${index}`,
          authorLogin: 'contributor',
          authorUserId: userId,
          mergedAt: null,
        },
      ]),
    );
    const reviews: SuspiciousReview[] = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      prId: index + 1,
      reviewerLogin: 'mentor',
      reviewerUserId: reviewerId,
      state: 'approved',
      submittedAt: `2026-05-19T1${index}:00:00Z`,
    }));

    const flags = detectReviewerApprovalConcentration(reviews, prs, {
      weekStart: '2026-05-13T00:00:00.000Z',
      weekEnd: '2026-05-20T00:00:00.000Z',
    });

    expect(flags).toHaveLength(1);
    expect(flags[0]?.reason).toBe('reviewer_approval_concentration');
  });
});
