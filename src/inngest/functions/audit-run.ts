import { inngest } from '../client';
import { getUserOctokit } from '@/lib/github/app';
import { getServiceSupabase } from '@/lib/supabase/service';
import { computeAuditScore, type AuditSignals } from '@/lib/xp/audit';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_SOURCE, refIds } from '@/lib/xp/sources';

/**
 * Audit pipeline. Fires once per user at signup. Idempotent — duplicate runs
 * silently no-op because xp_events has UNIQUE(user_id, source, ref_id) and
 * ref_id is keyed off github_id.
 */

type AuditEvent = {
  data: {
    userId: string;
    githubHandle: string;
    githubId: string;
    accessToken: string;
  };
};

export const auditRun = inngest.createFunction(
  { id: 'audit-run', concurrency: { key: 'event.data.userId', limit: 1 } },
  { event: 'audit/run' },
  async ({
    event,
    step,
  }: {
    event: AuditEvent;
    step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
  }) => {
    const { userId, githubHandle, githubId, accessToken } = event.data;

    const signals = await step.run('fetch-github-signals', async () => {
      const gh = getUserOctokit(accessToken);

      const user = await gh.users.getByUsername({ username: githubHandle });
      const accountAgeYears = Math.floor(
        (Date.now() - new Date(user.data.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365),
      );

      const mergedPrs = await gh.search.issuesAndPullRequests({
        q: `author:${githubHandle} type:pr is:merged`,
        per_page: 1,
      });

      const nonOwnMergedPrs = await gh.search.issuesAndPullRequests({
        q: `author:${githubHandle} type:pr is:merged -user:${githubHandle}`,
        per_page: 1,
      });

      const closedIssues = await gh.search.issuesAndPullRequests({
        q: `author:${githubHandle} type:issue is:closed`,
        per_page: 1,
      });

      const repos = await gh.repos.listForUser({
        username: githubHandle,
        per_page: 100,
        sort: 'pushed',
      });

      const distinctLanguages = new Set(
        repos.data.map((r) => r.language).filter((l): l is string => Boolean(l)),
      ).size;

      const out: AuditSignals = {
        accountAgeYears,
        mergedPrs: mergedPrs.data.total_count,
        nonOwnMergedPrs: nonOwnMergedPrs.data.total_count,
        closedIssues: closedIssues.data.total_count,
        distinctLanguages,
        yearlyContributions: 0, // populated in Phase 2 from heatmap source
        followers: user.data.followers,
      };
      return out;
    });

    const auditScore = computeAuditScore(signals);

    const inserted = await step.run('insert-audit-event', async () => {
      return insertXpEvent({
        userId,
        source: XP_SOURCE.GITHUB_AUDIT,
        refId: refIds.audit(githubId),
        xpDelta: auditScore,
        metadata: { signals },
      });
    });

    await step.run('mark-profile-audited', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role not configured');
      await sb.from('profiles').update({ audit_completed: true }).eq('id', userId);
    });

    return { inserted, auditScore, signals };
  },
);
