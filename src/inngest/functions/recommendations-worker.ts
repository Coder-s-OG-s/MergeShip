import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { filterAndRank, type ScoredIssue, type SkipCounts } from '@/lib/pipeline/recommend';
import { unwrapJoin } from '@/lib/supabase/inner-join';
import { SKIP_HISTORY_WINDOW_DAYS } from '@/lib/pipeline/constants';

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

type UserRow = {
  user_id: string;
  profiles: { level: number | null; primary_language: string | null };
};

export const recommendationsBuildWorker = inngest.createFunction(
  {
    id: 'recommendations-build-worker',
    concurrency: { limit: 5 },
    retries: 3,
  },
  [{ event: 'recommendations/build.worker' }],
  async ({ event, step }) => {
    // We expect userIds array in the event payload
    const userIds: string[] = (event.data?.userIds as string[]) ?? [];

    if (!userIds.length) {
      return { users: 0, inserted: 0 };
    }

    const built = await step.run('process-batch', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      // 1. Fetch candidate pool
      const { data: pool } = await sb
        .from('issues')
        .select(
          'id, repo_full_name, github_issue_number, title, difficulty, xp_reward, repo_health_score, repo_language, scored_at',
        )
        .eq('state', 'open')
        .order('scored_at', { ascending: false })
        .limit(500);

      const rawPool = (pool ?? []) as unknown as IssueRow[];
      if (rawPool.length === 0) return { users: userIds.length, inserted: 0 };

      // 2. Fetch profiles for this batch
      const { data: users } = await sb
        .from('github_installations')
        .select('user_id, profiles!inner(id, level, primary_language)')
        .in('user_id', userIds)
        .is('uninstalled_at', null)
        .not('user_id', 'is', null);

      const userList = (users ?? []) as unknown as UserRow[];
      if (userList.length === 0) return { users: 0, inserted: 0 };

      // 3. Fetch skip history for this batch
      const cutoffDate = new Date(
        Date.now() - SKIP_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: skipsData } = await sb
        .from('recommendations')
        .select('user_id, issues!inner(repo_full_name, repo_language)')
        .in('user_id', userIds)
        .eq('status', 'reassigned')
        .gte('recommended_at', cutoffDate);

      const skipHistoryMap: Record<string, SkipCounts> = {};
      for (const row of skipsData ?? []) {
        const userId = row.user_id;
        const issue = unwrapJoin<{
          repo_full_name: string;
          repo_language: string | null;
        }>((row as unknown as { issues: unknown }).issues);

        if (!issue?.repo_full_name) continue;

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

      // 4. Bulk-fetch seen recommendation issue_ids for this batch
      const seenByUser = new Map<string, Set<number>>();
      for (let from = 0; ; from += 1000) {
        const { data: seenPage } = await sb
          .from('recommendations')
          .select('user_id, issue_id')
          .in('user_id', userIds)
          .order('user_id')
          .order('issue_id')
          .range(from, from + 999);
        for (const row of seenPage ?? []) {
          if (!seenByUser.has(row.user_id)) {
            seenByUser.set(row.user_id, new Set());
          }
          seenByUser.get(row.user_id)!.add(row.issue_id);
        }
        if (!seenPage || seenPage.length < 1000) break;
      }

      let totalInserted = 0;
      for (const u of userList) {
        const level = u.profiles?.level ?? 0;
        const userLang = u.profiles?.primary_language ?? null;

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

        const excludeIds = seenByUser.get(u.user_id) ?? new Set<number>();
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
