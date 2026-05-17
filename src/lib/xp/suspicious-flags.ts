import { XP_SOURCE } from './sources';

export const XP_FLAG_THRESHOLDS = {
  dailyEventCount: 5,
  hourlyMergeCount: 3,
  weeklyReviewerPairCount: 4,
  hourlyWindowMs: 60 * 60 * 1000,
} as const;

export type XpAuditEvent = {
  id: number;
  userId: string;
  source: string;
  refId: string;
  repo: string | null;
  xpDelta: number;
  createdAt: string;
};

export type ReviewAuditEvent = {
  id: number;
  prId: number;
  reviewerUserId: string | null;
  authorUserId: string | null;
  state: string;
  submittedAt: string;
  repoFullName: string | null;
  prNumber: number | null;
};

export type FlagReason = 'daily_event_burst' | 'hourly_merge_burst' | 'review_pair_burst';
export type FlagSeverity = 'medium' | 'high';

export type FlagCandidate = {
  userId: string;
  reason: FlagReason;
  severity: FlagSeverity;
  dedupeKey: string;
  evidence: Record<string, unknown>;
};

const MERGE_SOURCES = new Set<string>([
  XP_SOURCE.RECOMMENDED_MERGE,
  XP_SOURCE.UNRECOMMENDED_MERGE,
]);

export function detectSuspiciousXpPatterns(args: {
  xpEvents: XpAuditEvent[];
  reviewEvents?: ReviewAuditEvent[];
  now?: Date;
}): FlagCandidate[] {
  const flags: FlagCandidate[] = [];
  flags.push(...detectDailyEventBursts(args.xpEvents));
  flags.push(...detectHourlyMergeBursts(args.xpEvents));
  flags.push(...detectReviewerPairBursts(args.reviewEvents ?? []));
  return dedupeFlags(flags);
}

function detectDailyEventBursts(events: XpAuditEvent[]): FlagCandidate[] {
  const groups = new Map<string, XpAuditEvent[]>();
  for (const event of events) {
    if (event.xpDelta <= 0) continue;
    const key = `${event.userId}:${utcDay(event.createdAt)}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  const flags: FlagCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length <= XP_FLAG_THRESHOLDS.dailyEventCount) continue;
    const [userId, day] = key.split(':');
    if (!userId || !day) continue;
    flags.push({
      userId,
      reason: 'daily_event_burst',
      severity: group.length >= XP_FLAG_THRESHOLDS.dailyEventCount * 2 ? 'high' : 'medium',
      dedupeKey: `daily-event-burst:${userId}:${day}`,
      evidence: {
        day,
        eventCount: group.length,
        threshold: XP_FLAG_THRESHOLDS.dailyEventCount,
        totalXp: group.reduce((sum, event) => sum + event.xpDelta, 0),
        sources: countBy(group.map((event) => event.source)),
        refs: group.slice(0, 10).map((event) => event.refId),
      },
    });
  }
  return flags;
}

function detectHourlyMergeBursts(events: XpAuditEvent[]): FlagCandidate[] {
  const byUser = new Map<string, XpAuditEvent[]>();
  for (const event of events) {
    if (!MERGE_SOURCES.has(event.source) || event.xpDelta <= 0) continue;
    byUser.set(event.userId, [...(byUser.get(event.userId) ?? []), event]);
  }

  const flags: FlagCandidate[] = [];
  for (const [userId, group] of byUser) {
    const sorted = [...group].sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    for (let start = 0; start < sorted.length; start += 1) {
      const windowStart = ts(sorted[start]!.createdAt);
      const window = sorted.filter((event) => {
        const eventTime = ts(event.createdAt);
        return (
          eventTime >= windowStart &&
          eventTime - windowStart <= XP_FLAG_THRESHOLDS.hourlyWindowMs
        );
      });
      if (window.length <= XP_FLAG_THRESHOLDS.hourlyMergeCount) continue;
      const first = window[0]!;
      const last = window[window.length - 1]!;
      flags.push({
        userId,
        reason: 'hourly_merge_burst',
        severity: window.length >= XP_FLAG_THRESHOLDS.hourlyMergeCount + 3 ? 'high' : 'medium',
        dedupeKey: `hourly-merge-burst:${userId}:${utcHour(first.createdAt)}`,
        evidence: {
          windowStart: first.createdAt,
          windowEnd: last.createdAt,
          mergeCount: window.length,
          threshold: XP_FLAG_THRESHOLDS.hourlyMergeCount,
          repos: [...new Set(window.map((event) => event.repo).filter(Boolean))],
          refs: window.map((event) => event.refId),
        },
      });
      break;
    }
  }
  return flags;
}

function detectReviewerPairBursts(events: ReviewAuditEvent[]): FlagCandidate[] {
  const groups = new Map<string, ReviewAuditEvent[]>();
  for (const event of events) {
    if (event.state !== 'approved') continue;
    if (!event.reviewerUserId || !event.authorUserId) continue;
    if (event.reviewerUserId === event.authorUserId) continue;
    const key = `${event.reviewerUserId}:${event.authorUserId}:${utcWeek(event.submittedAt)}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  const flags: FlagCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length <= XP_FLAG_THRESHOLDS.weeklyReviewerPairCount) continue;
    const [reviewerUserId, authorUserId, week] = key.split(':');
    if (!reviewerUserId || !authorUserId || !week) continue;
    flags.push({
      userId: reviewerUserId,
      reason: 'review_pair_burst',
      severity: group.length >= XP_FLAG_THRESHOLDS.weeklyReviewerPairCount + 3 ? 'high' : 'medium',
      dedupeKey: `review-pair-burst:${reviewerUserId}:${authorUserId}:${week}`,
      evidence: {
        week,
        reviewerUserId,
        authorUserId,
        reviewCount: group.length,
        threshold: XP_FLAG_THRESHOLDS.weeklyReviewerPairCount,
        prs: group.slice(0, 12).map((event) => ({
          id: event.prId,
          repo: event.repoFullName,
          number: event.prNumber,
        })),
      },
    });
  }
  return flags;
}

function dedupeFlags(flags: FlagCandidate[]): FlagCandidate[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    if (seen.has(flag.dedupeKey)) return false;
    seen.add(flag.dedupeKey);
    return true;
  });
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function utcHour(iso: string): string {
  return new Date(iso).toISOString().slice(0, 13);
}

function utcWeek(iso: string): string {
  const date = new Date(iso);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function ts(iso: string): number {
  return new Date(iso).getTime();
}
