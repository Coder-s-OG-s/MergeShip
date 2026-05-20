import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_REWARDS, XP_SOURCE, refIds } from '@/lib/xp/sources';
import {
  detectSuspiciousPatterns,
  type SuspiciousMergedPr,
  type SuspiciousReview,
  type SuspiciousXpEvent,
} from '@/lib/xp/suspicious-patterns';

/**
 * Daily streak detection — gives +10 XP/day to users who had any qualifying
 * activity yesterday, with a 10-day cap.
 */
export const streakDetect = inngest.createFunction(
  { id: 'streak-detect' },
  { cron: '5 0 * * *' }, // 00:05 UTC daily
  async ({ step }) => {
    const result = await step.run('detect-streaks', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

      // Pull anyone who logged an XP event yesterday.
      const { data: actives } = await sb
        .from('xp_events')
        .select('user_id')
        .gte('created_at', `${yesterday}T00:00:00Z`)
        .lt('created_at', `${today}T00:00:00Z`)
        .neq('source', XP_SOURCE.STREAK);

      const uniqueUsers = new Set((actives ?? []).map((r) => r.user_id));
      let awarded = 0;
      for (const userId of uniqueUsers) {
        const inserted = await insertXpEvent({
          userId,
          source: XP_SOURCE.STREAK,
          refType: 'streak',
          refId: refIds.streak(yesterday),
          xpDelta: XP_REWARDS.STREAK_PER_DAY,
        });
        if (inserted) awarded += 1;
      }
      return { awarded, scanned: uniqueUsers.size };
    });
    return result;
  },
);

/**
 * Expire stale recommendations.
 * recommendations.expires_at < now AND status='open' → 'expired'.
 */
export const recsExpire = inngest.createFunction(
  { id: 'recs-expire' },
  { cron: '0 * * * *' }, // hourly
  async ({ step }) => {
    return await step.run('expire-stale-recs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const now = new Date().toISOString();
      const { data } = await sb
        .from('recommendations')
        .update({ status: 'expired' })
        .lt('expires_at', now)
        .eq('status', 'open')
        .select('id');
      return { expired: data?.length ?? 0 };
    });
  },
);

/**
 * activity_log keeps 30 days of trail. Daily cleanup keeps it cheap.
 */
export const activityLogCleanup = inngest.createFunction(
  { id: 'activity-log-cleanup' },
  { cron: '15 0 * * *' }, // 00:15 UTC daily
  async ({ step }) => {
    return await step.run('cleanup', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data } = await sb.from('activity_log').delete().lt('created_at', cutoff).select('id');
      return { deleted: data?.length ?? 0 };
    });
  },
);

/**
 * Daily conservative fraud signal detection. This only flags accounts for
 * maintainer review; it never changes XP, labels, or profile state.
 */
export const flagSuspiciousXpAccounts = inngest.createFunction(
  { id: 'flag-suspicious-xp-accounts' },
  { cron: '30 0 * * *' }, // 00:30 UTC daily, after streaks and cleanup
  async ({ step }) => {
    return await step.run('detect-and-store-flags', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const service = sb;

      const dayEndDate = startOfUtcDay(new Date());
      const dayStartDate = new Date(dayEndDate.getTime() - 24 * 60 * 60 * 1000);
      const weekStartDate = new Date(dayEndDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const dayStart = dayStartDate.toISOString();
      const dayEnd = dayEndDate.toISOString();
      const weekStart = weekStartDate.toISOString();
      const weekEnd = dayEnd;

      const { data: xpRows, error: xpError } = await service
        .from('xp_events')
        .select('user_id, source, ref_id, repo, xp_delta, created_at')
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd);
      if (xpError) throw xpError;

      const { data: mergedRows, error: mergedError } = await service
        .from('pull_requests')
        .select('id, repo_full_name, number, title, author_login, author_user_id, merged_at')
        .eq('state', 'merged')
        .gte('merged_at', dayStart)
        .lt('merged_at', dayEnd);
      if (mergedError) throw mergedError;

      const { data: reviewRows, error: reviewError } = await service
        .from('pull_request_reviews')
        .select('id, pr_id, reviewer_login, reviewer_user_id, state, submitted_at')
        .eq('state', 'approved')
        .gte('submitted_at', weekStart)
        .lt('submitted_at', weekEnd);
      if (reviewError) throw reviewError;

      const reviewPrIds = Array.from(
        new Set((reviewRows ?? []).map((row) => Number(row.pr_id)).filter(Number.isFinite)),
      );
      const reviewPrRows = await fetchPullRequestsById(reviewPrIds);
      const mergedPullRequests = (mergedRows ?? []).map(mapPullRequestRow);
      const pullRequestsById = new Map<number, SuspiciousMergedPr>();
      for (const pr of [...mergedPullRequests, ...reviewPrRows]) {
        pullRequestsById.set(pr.id, pr);
      }

      const candidates = detectSuspiciousPatterns({
        xpEvents: (xpRows ?? []).map(mapXpEventRow),
        mergedPullRequests,
        reviews: (reviewRows ?? []).map(mapReviewRow),
        pullRequestsById,
        window: { dayStart, dayEnd, weekStart, weekEnd },
      });

      if (candidates.length === 0) {
        return { scanned: true, inserted: 0, candidates: 0 };
      }

      const { data: existingRows, error: existingError } = await service
        .from('flagged_accounts')
        .select('user_id, reason')
        .eq('status', 'open')
        .in(
          'user_id',
          Array.from(new Set(candidates.map((candidate) => candidate.userId))),
        );
      if (existingError) throw existingError;

      const existing = new Set(
        (existingRows ?? []).map((row) => `${row.user_id}:${row.reason}`),
      );
      const rowsToInsert = candidates
        .filter((candidate) => !existing.has(`${candidate.userId}:${candidate.reason}`))
        .map((candidate) => ({
          user_id: candidate.userId,
          reason: candidate.reason,
          severity: candidate.severity,
          status: 'open',
          evidence: candidate.evidence,
        }));

      if (rowsToInsert.length === 0) {
        return { scanned: true, inserted: 0, candidates: candidates.length };
      }

      const { data: insertedRows, error: insertError } = await service
        .from('flagged_accounts')
        .insert(rowsToInsert)
        .select('id');
      if (insertError) throw insertError;

      return {
        scanned: true,
        inserted: insertedRows?.length ?? 0,
        candidates: candidates.length,
      };

      async function fetchPullRequestsById(ids: number[]) {
        if (ids.length === 0) return [];

        const { data, error } = await service
          .from('pull_requests')
          .select('id, repo_full_name, number, title, author_login, author_user_id, merged_at')
          .in('id', ids);
        if (error) throw error;

        return (data ?? []).map(mapPullRequestRow);
      }
    });
  },
);

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function mapXpEventRow(row: {
  user_id: string | null;
  source: string | null;
  ref_id: string | null;
  repo: string | null;
  xp_delta: number | null;
  created_at: string;
}): SuspiciousXpEvent {
  return {
    userId: row.user_id,
    source: row.source,
    refId: row.ref_id,
    repo: row.repo,
    xpDelta: row.xp_delta,
    createdAt: row.created_at,
  };
}

function mapPullRequestRow(row: {
  id: number;
  repo_full_name: string;
  number: number;
  title: string;
  author_login: string;
  author_user_id: string | null;
  merged_at: string | null;
}): SuspiciousMergedPr {
  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    number: row.number,
    title: row.title,
    authorLogin: row.author_login,
    authorUserId: row.author_user_id,
    mergedAt: row.merged_at,
  };
}

function mapReviewRow(row: {
  id: number;
  pr_id: number;
  reviewer_login: string;
  reviewer_user_id: string | null;
  state: string;
  submitted_at: string;
}): SuspiciousReview {
  return {
    id: row.id,
    prId: row.pr_id,
    reviewerLogin: row.reviewer_login,
    reviewerUserId: row.reviewer_user_id,
    state: row.state,
    submittedAt: row.submitted_at,
  };
}
