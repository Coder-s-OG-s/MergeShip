export const SUSPICIOUS_XP_THRESHOLDS = {
  dailyXpEvents: 5,
  hourlyMerges: 3,
  weeklyReviewerApprovals: 4,
} as const;

export type SuspiciousXpEvent = {
  userId: string | null;
  source: string | null;
  refId: string | null;
  repo: string | null;
  xpDelta: number | null;
  createdAt: string;
};

export type SuspiciousMergedPr = {
  id: number;
  repoFullName: string;
  number: number;
  title: string;
  authorLogin: string;
  authorUserId: string | null;
  mergedAt: string | null;
};

export type SuspiciousReview = {
  id: number;
  prId: number;
  reviewerLogin: string;
  reviewerUserId: string | null;
  state: string;
  submittedAt: string;
};

export type SuspiciousFlagCandidate = {
  userId: string;
  reason: 'daily_xp_event_spike' | 'rapid_merge_spike' | 'reviewer_approval_concentration';
  severity: 'medium' | 'high';
  evidence: {
    summary: string;
    windowStart: string;
    windowEnd: string;
    count: number;
    items: Array<Record<string, string | number | null>>;
  };
};

type DetectionWindow = {
  dayStart: string;
  dayEnd: string;
  weekStart: string;
  weekEnd: string;
};

export function detectSuspiciousPatterns(args: {
  xpEvents: SuspiciousXpEvent[];
  mergedPullRequests: SuspiciousMergedPr[];
  reviews: SuspiciousReview[];
  pullRequestsById: Map<number, SuspiciousMergedPr>;
  window: DetectionWindow;
}): SuspiciousFlagCandidate[] {
  return [
    ...detectDailyXpEventSpikes(args.xpEvents, args.window),
    ...detectRapidMergeSpikes(args.mergedPullRequests, args.window),
    ...detectReviewerApprovalConcentration(args.reviews, args.pullRequestsById, args.window),
  ];
}

export function detectDailyXpEventSpikes(
  xpEvents: SuspiciousXpEvent[],
  window: Pick<DetectionWindow, 'dayStart' | 'dayEnd'>,
): SuspiciousFlagCandidate[] {
  const byUser = new Map<string, SuspiciousXpEvent[]>();

  for (const event of xpEvents) {
    if (!event.userId) continue;
    const bucket = byUser.get(event.userId) ?? [];
    bucket.push(event);
    byUser.set(event.userId, bucket);
  }

  const candidates: SuspiciousFlagCandidate[] = [];
  for (const [userId, events] of byUser) {
    if (events.length <= SUSPICIOUS_XP_THRESHOLDS.dailyXpEvents) continue;

    const totalXp = events.reduce((sum, event) => sum + (event.xpDelta ?? 0), 0);
    candidates.push({
      userId,
      reason: 'daily_xp_event_spike',
      severity: events.length >= SUSPICIOUS_XP_THRESHOLDS.dailyXpEvents * 2 ? 'high' : 'medium',
      evidence: {
        summary: `${events.length} XP events in one UTC day (${totalXp} XP total).`,
        windowStart: window.dayStart,
        windowEnd: window.dayEnd,
        count: events.length,
        items: events.slice(0, 20).map((event) => ({
          source: event.source,
          refId: event.refId,
          repo: event.repo,
          xpDelta: event.xpDelta,
          createdAt: event.createdAt,
        })),
      },
    });
  }

  return candidates;
}

export function detectRapidMergeSpikes(
  mergedPullRequests: SuspiciousMergedPr[],
  window: Pick<DetectionWindow, 'dayStart' | 'dayEnd'>,
): SuspiciousFlagCandidate[] {
  const byUser = new Map<string, SuspiciousMergedPr[]>();

  for (const pr of mergedPullRequests) {
    if (!pr.authorUserId || !pr.mergedAt) continue;
    const bucket = byUser.get(pr.authorUserId) ?? [];
    bucket.push(pr);
    byUser.set(pr.authorUserId, bucket);
  }

  const candidates: SuspiciousFlagCandidate[] = [];
  for (const [userId, prs] of byUser) {
    const sorted = prs
      .slice()
      .sort((a, b) => Date.parse(a.mergedAt ?? '') - Date.parse(b.mergedAt ?? ''));

    for (let start = 0; start < sorted.length; start += 1) {
      const startPr = sorted[start];
      if (!startPr?.mergedAt) continue;

      const startMs = Date.parse(startPr.mergedAt);
      const oneHourLater = startMs + 60 * 60 * 1000;
      const burst = sorted.filter((pr) => {
        if (!pr.mergedAt) return false;
        const mergedMs = Date.parse(pr.mergedAt);
        return mergedMs >= startMs && mergedMs <= oneHourLater;
      });

      if (burst.length <= SUSPICIOUS_XP_THRESHOLDS.hourlyMerges) continue;

      candidates.push({
        userId,
        reason: 'rapid_merge_spike',
        severity: burst.length >= SUSPICIOUS_XP_THRESHOLDS.hourlyMerges + 3 ? 'high' : 'medium',
        evidence: {
          summary: `${burst.length} merged PRs landed inside one hour.`,
          windowStart: startPr.mergedAt,
          windowEnd: new Date(oneHourLater).toISOString(),
          count: burst.length,
          items: burst.slice(0, 20).map((pr) => ({
            repoFullName: pr.repoFullName,
            number: pr.number,
            title: pr.title,
            authorLogin: pr.authorLogin,
            mergedAt: pr.mergedAt,
          })),
        },
      });
      break;
    }
  }

  return candidates;
}

export function detectReviewerApprovalConcentration(
  reviews: SuspiciousReview[],
  pullRequestsById: Map<number, SuspiciousMergedPr>,
  window: Pick<DetectionWindow, 'weekStart' | 'weekEnd'>,
): SuspiciousFlagCandidate[] {
  const byPair = new Map<string, { contributorId: string; reviews: SuspiciousReview[] }>();

  for (const review of reviews) {
    if (review.state !== 'approved' || !review.reviewerUserId) continue;
    const pr = pullRequestsById.get(review.prId);
    if (!pr?.authorUserId) continue;

    const key = `${pr.authorUserId}:${review.reviewerUserId}`;
    const bucket = byPair.get(key) ?? { contributorId: pr.authorUserId, reviews: [] };
    bucket.reviews.push(review);
    byPair.set(key, bucket);
  }

  const candidates: SuspiciousFlagCandidate[] = [];
  for (const { contributorId, reviews: pairReviews } of byPair.values()) {
    if (pairReviews.length <= SUSPICIOUS_XP_THRESHOLDS.weeklyReviewerApprovals) continue;

    candidates.push({
      userId: contributorId,
      reason: 'reviewer_approval_concentration',
      severity:
        pairReviews.length >= SUSPICIOUS_XP_THRESHOLDS.weeklyReviewerApprovals + 3
          ? 'high'
          : 'medium',
      evidence: {
        summary: `${pairReviews.length} approvals from the same reviewer in one week.`,
        windowStart: window.weekStart,
        windowEnd: window.weekEnd,
        count: pairReviews.length,
        items: pairReviews.slice(0, 20).map((review) => {
          const pr = pullRequestsById.get(review.prId);
          return {
            reviewerLogin: review.reviewerLogin,
            repoFullName: pr?.repoFullName ?? null,
            number: pr?.number ?? null,
            title: pr?.title ?? null,
            submittedAt: review.submittedAt,
          };
        }),
      },
    });
  }

  return candidates;
}
