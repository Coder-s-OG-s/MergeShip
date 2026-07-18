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
import { computeCurrentStreak } from '@/lib/xp/streak';

const AUDIT_PAGE_SIZE = 1000;
const AUDIT_FILTER_CHUNK_SIZE = 500;

type SupabasePage<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

async function fetchAllAuditRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += AUDIT_PAGE_SIZE) {
    const to = from + AUDIT_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message ?? 'Supabase audit query failed');

    const page = data ?? [];
    rows.push(...page);

    if (page.length < AUDIT_PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchChunkedAuditRows<T, TFilter>(
  filters: TFilter[],
  buildQuery: (chunk: TFilter[], from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let start = 0; start < filters.length; start += AUDIT_FILTER_CHUNK_SIZE) {
    const chunk = filters.slice(start, start + AUDIT_FILTER_CHUNK_SIZE);
    rows.push(...(await fetchAllAuditRows((from, to) => buildQuery(chunk, from, to))));
  }

  return rows;
}

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
      const maxDays = XP_REWARDS.STREAK_CAP / XP_REWARDS.STREAK_PER_DAY;
      const streakCutoffDate = new Date(Date.now() - (maxDays + 1) * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      // Bulk-fetch XP events for all active users in the streak window
      // to avoid N+1 per-user queries.
      const activeUserIds = [...uniqueUsers].filter((id): id is string => !!id);
      const eventsByUser = new Map<string, Array<{ created_at: string }>>();
      for (let i = 0; i < activeUserIds.length; i += 100) {
        const chunk = activeUserIds.slice(i, i + 100);
        for (let from = 0; ; from += 1000) {
          const { data: eventsPage } = await sb
            .from('xp_events')
            .select('user_id, created_at')
            .in('user_id', chunk)
            .gte('created_at', `${streakCutoffDate}T00:00:00Z`)
            .lt('created_at', `${today}T00:00:00Z`)
            .range(from, from + 999);
          for (const row of eventsPage ?? []) {
            if (!row.user_id) continue;
            if (!eventsByUser.has(row.user_id)) {
              eventsByUser.set(row.user_id, []);
            }
            eventsByUser.get(row.user_id)!.push({ created_at: row.created_at });
          }
          if (!eventsPage || eventsPage.length < 1000) break;
        }
      }

      let awarded = 0;
      for (const userId of activeUserIds) {
        const userEvents = eventsByUser.get(userId) ?? [];
        const streakDays = computeCurrentStreak(userEvents, yesterday);

        if (streakDays > maxDays) {
          continue;
        }

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
 * recommendations.expires_at < now AND status IN ('open','claimed') → 'expired'.
 * Including 'claimed' ensures abandoned claims are freed so users are not
 * permanently locked out of the 3-claim limit.
 */
export const recsExpire = inngest.createFunction(
  { id: 'recs-expire' },
  { cron: '0 */6 * * *' }, // every 6 hours
  async ({ step }) => {
    return await step.run('expire-stale-recs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const now = new Date().toISOString();
      const { data } = await sb
        .from('recommendations')
        .update({ status: 'expired' })
        .lt('expires_at', now)
        .in('status', ['open', 'claimed'])
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

      const [xpRows, mergedRows, reviewRows] = await Promise.all([
        fetchAllAuditRows<XpEventAuditRow>(
          (from, to) =>
            service
              .from('xp_events')
              .select('id, user_id, source, ref_id, repo, xp_delta, created_at')
              .gte('created_at', dayStart)
              .lt('created_at', dayEnd)
              .order('created_at', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to) as unknown as PromiseLike<SupabasePage<XpEventAuditRow>>,
        ),
        fetchAllAuditRows<PullRequestAuditRow>(
          (from, to) =>
            service
              .from('pull_requests')
              .select('id, repo_full_name, number, title, author_login, author_user_id, merged_at')
              .eq('state', 'merged')
              .gte('merged_at', dayStart)
              .lt('merged_at', dayEnd)
              .order('merged_at', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to) as unknown as PromiseLike<SupabasePage<PullRequestAuditRow>>,
        ),
        fetchAllAuditRows<ReviewAuditRow>(
          (from, to) =>
            service
              .from('pull_request_reviews')
              .select('id, pr_id, reviewer_login, reviewer_user_id, state, submitted_at')
              .eq('state', 'approved')
              .gte('submitted_at', weekStart)
              .lt('submitted_at', weekEnd)
              .order('submitted_at', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to) as unknown as PromiseLike<SupabasePage<ReviewAuditRow>>,
        ),
      ]);

      const reviewPrIds = Array.from(
        new Set(reviewRows.map((row) => Number(row.pr_id)).filter(Number.isFinite)),
      );
      const reviewPrRows = await fetchPullRequestsById(reviewPrIds);
      const mergedPullRequests = mergedRows.map(mapPullRequestRow);
      const pullRequestsById = new Map<number, SuspiciousMergedPr>();
      for (const pr of [...mergedPullRequests, ...reviewPrRows]) {
        pullRequestsById.set(pr.id, pr);
      }

      const candidates = detectSuspiciousPatterns({
        xpEvents: xpRows.map(mapXpEventRow),
        mergedPullRequests,
        reviews: reviewRows.map(mapReviewRow),
        pullRequestsById,
        window: { dayStart, dayEnd, weekStart, weekEnd },
      });

      if (candidates.length === 0) {
        return { scanned: true, inserted: 0, candidates: 0 };
      }

      const candidateUserIds = Array.from(new Set(candidates.map((candidate) => candidate.userId)));
      const existingRows = await fetchChunkedAuditRows<FlaggedAccountAuditRow, string>(
        candidateUserIds,
        (chunk, from, to) =>
          service
            .from('flagged_accounts')
            .select('user_id, reason')
            .eq('status', 'open')
            .in('user_id', chunk)
            .order('user_id', { ascending: true })
            .order('reason', { ascending: true })
            .range(from, to) as unknown as PromiseLike<SupabasePage<FlaggedAccountAuditRow>>,
      );

      const existing = new Set(existingRows.map((row) => `${row.user_id}:${row.reason}`));
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

        return (
          await fetchChunkedAuditRows<PullRequestAuditRow, number>(
            ids,
            (chunk, from, to) =>
              service
                .from('pull_requests')
                .select(
                  'id, repo_full_name, number, title, author_login, author_user_id, merged_at',
                )
                .in('id', chunk)
                .order('id', { ascending: true })
                .range(from, to) as unknown as PromiseLike<SupabasePage<PullRequestAuditRow>>,
          )
        ).map(mapPullRequestRow);
      }
    });
  },
);

const CLAIM_STALE_THRESHOLD_DAYS = 14;
const CLAIM_WARNING_THRESHOLD_DAYS = 10;

/**
 * Auto-unclaim stale recommendations after 14 days without a linked PR
 * and send warning notifications at day 10.
 */
export const autoUnclaimStale = inngest.createFunction(
  { id: 'auto-unclaim-stale' },
  { cron: '30 0 * * *' }, // 00:30 UTC daily
  async ({ step }) => {
    const unclaimResult = await step.run('unclaim-stale-recs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const threshold = new Date(
        Date.now() - CLAIM_STALE_THRESHOLD_DAYS * 24 * 3600 * 1000,
      ).toISOString();

      const { data: updatedRecs, error } = await sb
        .from('recommendations')
        .update({ status: 'open', claimed_at: null })
        .eq('status', 'claimed')
        .is('linked_pr_url', null)
        .lt('claimed_at', threshold)
        .select('id, user_id');

      if (error) throw new Error(`unclaim update failed: ${error.message}`);

      if (updatedRecs && updatedRecs.length > 0) {
        const logs = updatedRecs.map((rec) => ({
          user_id: rec.user_id,
          kind: 'claim_reset_stale',
          detail: { recId: rec.id } as never,
        }));
        await sb.from('activity_log').insert(logs);
      }

      return { unclaimed: updatedRecs?.length ?? 0 };
    });

    const warnResult = await step.run('warn-stale-recs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const warnMin = new Date(
        Date.now() - (CLAIM_WARNING_THRESHOLD_DAYS + 1) * 24 * 3600 * 1000,
      ).toISOString();
      const warnMax = new Date(
        Date.now() - CLAIM_WARNING_THRESHOLD_DAYS * 24 * 3600 * 1000,
      ).toISOString();

      const { data: toWarn, error } = await sb
        .from('recommendations')
        .select('id, user_id')
        .eq('status', 'claimed')
        .is('linked_pr_url', null)
        .gte('claimed_at', warnMin)
        .lt('claimed_at', warnMax);

      if (error) throw new Error(`warn query failed: ${error.message}`);

      if (toWarn && toWarn.length > 0) {
        const warnLogs = toWarn.map((rec) => ({
          user_id: rec.user_id,
          kind: 'claim_warning_stale',
          detail: { recId: rec.id, daysClaimed: CLAIM_WARNING_THRESHOLD_DAYS } as never,
        }));
        await sb.from('activity_log').insert(warnLogs);
      }

      return { warned: toWarn?.length ?? 0 };
    });

    return { ...unclaimResult, ...warnResult };
  },
);

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type XpEventAuditRow = {
  id: number;
  user_id: string | null;
  source: string | null;
  ref_id: string | null;
  repo: string | null;
  xp_delta: number | null;
  created_at: string;
};

type PullRequestAuditRow = {
  id: number;
  repo_full_name: string;
  number: number;
  title: string;
  author_login: string;
  author_user_id: string | null;
  merged_at: string | null;
};

type ReviewAuditRow = {
  id: number;
  pr_id: number;
  reviewer_login: string;
  reviewer_user_id: string | null;
  state: string;
  submitted_at: string;
};

type FlaggedAccountAuditRow = {
  user_id: string;
  reason: string;
};

function mapXpEventRow(row: XpEventAuditRow): SuspiciousXpEvent {
  return {
    userId: row.user_id,
    source: row.source,
    refId: row.ref_id,
    repo: row.repo,
    xpDelta: row.xp_delta,
    createdAt: row.created_at,
  };
}

function mapPullRequestRow(row: PullRequestAuditRow): SuspiciousMergedPr {
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

function mapReviewRow(row: ReviewAuditRow): SuspiciousReview {
  return {
    id: row.id,
    prId: row.pr_id,
    reviewerLogin: row.reviewer_login,
    reviewerUserId: row.reviewer_user_id,
    state: row.state,
    submittedAt: row.submitted_at,
  };
}
