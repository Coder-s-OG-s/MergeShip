import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallationToken } from '@/lib/github/app';
import { fetchMergedCount, fetchContributionStreak } from '@/app/actions/github-sync-helpers';
import { cacheDel } from '@/lib/cache';

type StatsSyncEvent = { data: { userId: string; githubHandle: string } };

export const githubStatsSync = inngest.createFunction(
  { id: 'github-stats-sync', concurrency: { key: 'event.data.userId', limit: 1 } },
  { event: 'github/stats-sync' },
  async ({
    event,
    step,
  }: {
    event: StatsSyncEvent;
    step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
  }) => {
    return await step.run('sync-github-stats', async () => {
      const { userId, githubHandle } = event.data;
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role not configured');

      const { data: install } = await sb
        .from('github_installations')
        .select('id')
        .eq('user_id', userId)
        .is('uninstalled_at', null)
        .order('installed_at', { ascending: false })
        .limit(1);

      const installId = (install as { id: number }[] | null)?.[0]?.id;
      if (!installId) throw new Error('no GitHub App installation found');

      const token = await getInstallationToken(installId);
      const [merges, streak] = await Promise.all([
        fetchMergedCount(token, githubHandle),
        fetchContributionStreak(token, githubHandle),
      ]);

      await sb
        .from('profiles')
        .update({
          github_total_merges: merges,
          github_streak: streak,
          github_stats_synced_at: new Date().toISOString(),
        })
        .eq('id', userId);

      await cacheDel(`gh:dashboard:${userId}`);
      return { merges, streak };
    });
  },
);
