import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import {
  detectSuspiciousXpPatterns,
  type ReviewAuditEvent,
  type XpAuditEvent,
} from '@/lib/xp/suspicious-flags';

const LOOKBACK_DAYS = 8;
const AUDIT_PAGE_SIZE = 1000;

type SupabasePage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function fetchAllAuditRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += AUDIT_PAGE_SIZE) {
    const to = from + AUDIT_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page);

    if (page.length < AUDIT_PAGE_SIZE) {
      return rows;
    }
  }
}

export const suspiciousXpAudit = inngest.createFunction(
  { id: 'suspicious-xp-audit' },
  { cron: '30 2 * * *' },
  async ({ step }) => {
    return await step.run('detect-and-upsert-flags', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const [xpRows, reviewRows] = await Promise.all([
        fetchAllAuditRows((from, to) =>
          sb
            .from('xp_events')
            .select('id, user_id, source, ref_id, repo, xp_delta, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
        fetchAllAuditRows((from, to) =>
          sb
            .from('pull_request_reviews')
            .select(
              'id, pr_id, reviewer_user_id, state, submitted_at, ' +
                'pull_requests!inner(author_user_id, repo_full_name, number)',
            )
            .gte('submitted_at', since)
            .order('submitted_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ]);

      const xpEvents: XpAuditEvent[] = xpRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        source: row.source,
        refId: row.ref_id,
        repo: row.repo,
        xpDelta: row.xp_delta,
        createdAt: row.created_at,
      }));

      const reviewEvents: ReviewAuditEvent[] = reviewRows.map((row) => {
        const pr = Array.isArray(row.pull_requests)
          ? row.pull_requests[0]
          : row.pull_requests;
        return {
          id: row.id,
          prId: row.pr_id,
          reviewerUserId: row.reviewer_user_id,
          authorUserId: pr?.author_user_id ?? null,
          state: row.state,
          submittedAt: row.submitted_at,
          repoFullName: pr?.repo_full_name ?? null,
          prNumber: pr?.number ?? null,
        };
      });

      const flags = detectSuspiciousXpPatterns({ xpEvents, reviewEvents });
      if (flags.length === 0) {
        return { scannedXpEvents: xpEvents.length, scannedReviews: reviewEvents.length, flags: 0 };
      }

      const { error } = await sb.from('flagged_accounts').upsert(
        flags.map((flag) => ({
          user_id: flag.userId,
          reason: flag.reason,
          severity: flag.severity,
          status: 'open',
          dedupe_key: flag.dedupeKey,
          evidence: flag.evidence,
        })),
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);

      return {
        scannedXpEvents: xpEvents.length,
        scannedReviews: reviewEvents.length,
        flags: flags.length,
      };
    });
  },
);
