import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import {
  detectSuspiciousXpPatterns,
  type ReviewAuditEvent,
  type XpAuditEvent,
} from '@/lib/xp/suspicious-flags';

const LOOKBACK_DAYS = 8;

export const suspiciousXpAudit = inngest.createFunction(
  { id: 'suspicious-xp-audit' },
  { cron: '30 2 * * *' },
  async ({ step }) => {
    return await step.run('detect-and-upsert-flags', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const [xpRes, reviewsRes] = await Promise.all([
        sb
          .from('xp_events')
          .select('id, user_id, source, ref_id, repo, xp_delta, created_at')
          .gte('created_at', since),
        sb
          .from('pull_request_reviews')
          .select(
            'id, pr_id, reviewer_user_id, state, submitted_at, ' +
              'pull_requests!inner(author_user_id, repo_full_name, number)',
          )
          .gte('submitted_at', since),
      ]);

      if (xpRes.error) throw new Error(xpRes.error.message);
      if (reviewsRes.error) throw new Error(reviewsRes.error.message);

      const xpEvents: XpAuditEvent[] = (xpRes.data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        source: row.source,
        refId: row.ref_id,
        repo: row.repo,
        xpDelta: row.xp_delta,
        createdAt: row.created_at,
      }));

      const reviewEvents: ReviewAuditEvent[] = (reviewsRes.data ?? []).map((row) => {
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
