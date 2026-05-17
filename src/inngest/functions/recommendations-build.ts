import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { filterAndRank, type ScoredIssue, type SkipCounts } from '@/lib/pipeline/recommend';
import { SKIP_HISTORY_WINDOW_DAYS } from '@/lib/pipeline/constants';

/**
 * For every active user, derive a fresh set of recommendation rows from the
 * pre-scored `issues` table. Idempotent via UNIQUE(user_id, issue_id) on
 * `recommendations` — replays just no-op on existing picks.
 *
 * Triggered after each issues-sweep and on its own slow cron as a backstop.
 */

const REC_TTL_DAYS = 7;

type IssueRow = {
  id: number;
  repo_full_name: string;
  github_issue_number: number;
  title: string;
  difficulty: 'E' | 'M' | 'H';
  xp_reward: number;
  repo_health_score: number | null;
  repo_language: string | null;
  scored_at: string;
};

export const recommendationsBuild = inngest.createFunction(
  { id: 'recommendations-build', concurrency: { limit: 1 } },
  [{ event: 'recommendations/build' }, { cron: '*/45 * * * *' }],
  async ({ step }) => {
    const built = await step.run('build-all', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      // All scored, open issues form the candidate pool. Cap to a sane size
      // — at 10k users the pool is bounded by repo count, not user count.
      const { data: pool } = await sb
        .from('issues')
        .select(
          'id, repo_full_name, github_issue_number, title, difficulty, xp_reward, repo_health_score, repo_language, scored_at',
        )
        .eq('state', 'open')
        .order('scored_at', { ascending: false })
        .limit(500);

      const rawPool = (pool ?? []) as unknown as IssueRow[];

      if (rawPool.length === 0) return { users: 0, inserted: 0 };

      // Pull every user with an active install — these are the only users
      // who pass the gate and have a dashboard worth populating.
      const { data: users } = await sb
        .from('github_installations')
        .select('user_id, profiles!inner(id, level, primary_language)')
        .is('uninstalled_at', null)
        .not('user_id', 'is', null);

      type UserRow = {
        user_id: string;
        profiles: { level: number | null; primary_language: string | null };
      };
      const userList = (users ?? []) as unknown as UserRow[];

      // Build bulk skip-history lookup map (Issue #91)
      // Avoids N+1 queries by fetching all skips in the trailing window at once.
      const cutoffDate = new Date(
        Date.now() - SKIP_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: skipsData } = await sb
        .from('recommendations')
        .select('user_id, issues!inner(repo_full_name, repo_language)')
        .eq('status', 'reassigned')
        .gte('recommended_at', cutoffDate);

      const skipHistoryMap: Record<string, SkipCounts> = {};
      for (const row of skipsData ?? []) {
        const userId = row.user_id;
        const issue = row.issues as unknown as {
          repo_full_name: string;
          repo_language: string | null;
        };

        if (!skipHistoryMap[userId]) {
          skipHistoryMap[userId] = { byRepo: {}, byLanguage: {} };
        }

        const counts = skipHistoryMap[userId];
        counts.byRepo[issue.repo_full_name] = (counts.byRepo[issue.repo_full_name] ?? 0) + 1;

        if (issue.repo_language) {
          counts.byLanguage[issue.repo_language] =
            (counts.byLanguage[issue.repo_language] ?? 0) + 1;
        }
      }

      let totalInserted = 0;
      for (const u of userList) {
        const level = u.profiles?.level ?? 0;
        const userLang = u.profiles?.primary_language ?? null;

        // Build per-user candidates so languageMatch reflects this user's
        // primary_language. Pool is shared; only the language flag varies.
        const candidates: ScoredIssue[] = rawPool.map((i) => ({
          repoLanguage: i.repo_language,
          id: i.id,
          repoFullName: i.repo_full_name,
          number: i.github_issue_number,
          title: i.title,
          difficulty: i.difficulty,
          xpReward: i.xp_reward,
          repoHealthScore: i.repo_health_score ?? 50,
          freshnessHours: Math.max(0, (Date.now() - new Date(i.scored_at).getTime()) / 36e5),
          languageMatch:
            userLang !== null && i.repo_language !== null && i.repo_language === userLang,
        }));

        // Skip issues this user has already seen — any prior rec, regardless
        // of status. Reassigned / expired ones aren't worth re-offering.
        const { data: seen } = await sb
          .from('recommendations')
          .select('issue_id')
          .eq('user_id', u.user_id);
        const excludeIds = new Set((seen ?? []).map((r) => r.issue_id));
        const skipCounts = skipHistoryMap[u.user_id];

        const picks = filterAndRank(candidates, {
          level,
          excludeIssueIds: excludeIds,
          allowFallback: true,
          skipCounts,
        });

        if (picks.length === 0) continue;

        const expiresAt = new Date(Date.now() + REC_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const rows = picks.map((p) => ({
          user_id: u.user_id,
          issue_id: p.id,
          difficulty: p.difficulty,
          xp_reward: p.xpReward,
          recommended_at: new Date().toISOString(),
          expires_at: expiresAt,
          status: 'open' as const,
        }));

        const { error } = await sb
          .from('recommendations')
          .upsert(rows, { onConflict: 'user_id,issue_id', ignoreDuplicates: true });
        if (!error) totalInserted += rows.length;
      }

      return { users: userList.length, inserted: totalInserted };
    });

    return built;
  },
);
