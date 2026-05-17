import { describe, expect, it } from 'vitest';
import {
  detectSuspiciousXpPatterns,
  XP_FLAG_THRESHOLDS,
  type XpAuditEvent,
} from './suspicious-flags';
import { XP_SOURCE } from './sources';

const xp = (overrides: Partial<XpAuditEvent> = {}): XpAuditEvent => ({
  id: overrides.id ?? 1,
  userId: overrides.userId ?? 'user-1',
  source: overrides.source ?? XP_SOURCE.COMMENT,
  refId: overrides.refId ?? `ref-${overrides.id ?? 1}`,
  repo: overrides.repo ?? 'org/repo',
  xpDelta: overrides.xpDelta ?? 1,
  createdAt: overrides.createdAt ?? '2026-05-17T00:00:00.000Z',
});

describe('detectSuspiciousXpPatterns', () => {
  it('flags more than five positive XP events in a UTC day', () => {
    const events = Array.from({ length: XP_FLAG_THRESHOLDS.dailyEventCount + 1 }, (_, index) =>
      xp({ id: index + 1, refId: `comment-${index + 1}` }),
    );

    const flags = detectSuspiciousXpPatterns({ xpEvents: events });

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      userId: 'user-1',
      reason: 'daily_event_burst',
      severity: 'medium',
    });
    expect(flags[0]!.evidence).toMatchObject({
      day: '2026-05-17',
      eventCount: 6,
      threshold: XP_FLAG_THRESHOLDS.dailyEventCount,
    });
  });

  it('escalates daily XP bursts to high severity when volume doubles the threshold', () => {
    const events = Array.from({ length: XP_FLAG_THRESHOLDS.dailyEventCount * 2 }, (_, index) =>
      xp({ id: index + 1, refId: `comment-${index + 1}` }),
    );

    const flags = detectSuspiciousXpPatterns({ xpEvents: events });

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      userId: 'user-1',
      reason: 'daily_event_burst',
      severity: 'high',
    });
  });

  it('does not flag daily events at the threshold boundary or penalty events', () => {
    const events = [
      ...Array.from({ length: XP_FLAG_THRESHOLDS.dailyEventCount }, (_, index) =>
        xp({ id: index + 1 }),
      ),
      xp({ id: 99, xpDelta: -50 }),
    ];

    expect(detectSuspiciousXpPatterns({ xpEvents: events })).toEqual([]);
  });

  it('flags more than three merge XP events inside a one-hour window', () => {
    const events = Array.from({ length: XP_FLAG_THRESHOLDS.hourlyMergeCount + 1 }, (_, index) =>
      xp({
        id: index + 1,
        source: XP_SOURCE.RECOMMENDED_MERGE,
        refId: `pr:org/repo:${index + 1}`,
        xpDelta: 150,
        createdAt: `2026-05-17T00:${String(index * 10).padStart(2, '0')}:00.000Z`,
      }),
    );

    const flags = detectSuspiciousXpPatterns({ xpEvents: events });

    expect(flags.some((flag) => flag.reason === 'hourly_merge_burst')).toBe(true);
    expect(flags.find((flag) => flag.reason === 'hourly_merge_burst')!.evidence).toMatchObject({
      mergeCount: 4,
      threshold: XP_FLAG_THRESHOLDS.hourlyMergeCount,
    });
  });

  it('flags reviewer and contributor pairs with too many approvals in one UTC week', () => {
    const reviewEvents = Array.from(
      { length: XP_FLAG_THRESHOLDS.weeklyReviewerPairCount + 1 },
      (_, index) => ({
        id: index + 1,
        prId: 100 + index,
        reviewerUserId: 'reviewer-1',
        authorUserId: 'author-1',
        state: 'approved',
        submittedAt: `2026-05-${String(11 + index).padStart(2, '0')}T12:00:00.000Z`,
        repoFullName: 'org/repo',
        prNumber: index + 1,
      }),
    );

    const flags = detectSuspiciousXpPatterns({ xpEvents: [], reviewEvents });

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      userId: 'reviewer-1',
      reason: 'review_pair_burst',
    });
    expect(flags[0]!.evidence).toMatchObject({
      authorUserId: 'author-1',
      reviewCount: 5,
    });
  });
});
