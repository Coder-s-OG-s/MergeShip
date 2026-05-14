import { inngest } from '../client';
import { getInstallOctokit, getUserOctokit } from '@/lib/github/app';
import { getServiceSupabase } from '@/lib/supabase/service';
import { computeAuditScore, type AuditSignals } from '@/lib/xp/audit';
import { clampAuditScoreToLevel } from '@/lib/xp/audit-clamp';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_SOURCE, refIds } from '@/lib/xp/sources';

const AUDIT_MAX_LEVEL = 2;

/**
 * Audit pipeline. Fires once per user, ideally right after their GitHub App
 * install lands. Idempotent — duplicate runs silently no-op because xp_events
 * has UNIQUE(user_id, source, ref_id) keyed off github_id.
 *
 * Auth precedence:
 *   1. event.data.accessToken (user OAuth token, freshly minted at sign-in)
 *      — used when audit is fired during the bootstrap flow.
 *   2. install token minted from event.data.installationId
 *      — used when audit is fired from the install webhook handler. Install
 *      tokens are minted on demand from the App JWT and don't expire on us.
 *
 * The function does everything in a single step.run so retries replay the
 * whole pipeline. Combined with the xp_events UNIQUE constraint, no zombie
 * "xp awarded but audit_completed=false" state is possible.
 */

type AuditEvent = {
  data: {
    userId: string;
    githubHandle: string;
    githubId: string;
    accessToken?: string;
    installationId?: number;
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
    return await step.run('run-audit', async () => {
      const { userId, githubHandle, githubId } = event.data;
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role not configured');

      // Idempotency short-circuit. Profile check before we spend GitHub API
      // budget on a user who's already been audited (covers replays + the
      // double-trigger from both bootstrap and install paths firing).
      const { data: profile } = await sb
        .from('profiles')
        .select('audit_completed')
        .eq('id', userId)
        .maybeSingle();
      if (!profile) return { skipped: true, reason: 'no_profile' };
      if (profile.audit_completed) return { skipped: true, reason: 'already_audited' };

      // Pick the auth source. Install token preferred — doesn't expire on
      // queue delay. OAuth token falls back if we don't have an install yet.
      let gh;
      if (event.data.installationId) {
        gh = await getInstallOctokit(event.data.installationId);
      } else {
        // Look up install on the fly — covers the case where audit was
        // queued at bootstrap and install completed between then and now.
        const { data: install } = await sb
          .from('github_installations')
          .select('id')
          .eq('user_id', userId)
          .is('uninstalled_at', null)
          .order('installed_at', { ascending: false })
          .limit(1);
        const installId = install?.[0]?.id;
        if (installId) {
          gh = await getInstallOctokit(installId);
        } else if (event.data.accessToken) {
          gh = getUserOctokit(event.data.accessToken);
        } else {
          return { skipped: true, reason: 'no_auth_source' };
        }
      }

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

      const signals: AuditSignals = {
        accountAgeYears,
        mergedPrs: mergedPrs.data.total_count,
        nonOwnMergedPrs: nonOwnMergedPrs.data.total_count,
        closedIssues: closedIssues.data.total_count,
        distinctLanguages,
        yearlyContributions: 0, // populated in Phase 2 from heatmap source
        followers: user.data.followers,
      };
      const rawAuditScore = computeAuditScore(signals);
      // Anti-cheat: audit-only placement never exceeds L2 regardless of the
      // raw score. Going beyond requires actual MergeShip activity.
      const auditScore = clampAuditScoreToLevel(rawAuditScore, AUDIT_MAX_LEVEL);

      const inserted = await insertXpEvent({
        userId,
        source: XP_SOURCE.GITHUB_AUDIT,
        refId: refIds.audit(githubId),
        xpDelta: auditScore,
        metadata: { signals, rawAuditScore, clampedToLevel: AUDIT_MAX_LEVEL },
      });

      await sb.from('profiles').update({ audit_completed: true }).eq('id', userId);

      return { inserted, rawAuditScore, auditScore, signals };
    });
  },
);
