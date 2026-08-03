'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import { cacheDel, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import {
  fetchMergedCount,
  fetchContributionStreak,
  fetchContributionCalendar,
  fetchAndBackfillPRs,
} from './github-sync-helpers';

// Backfill + types live in github-sync-helpers so the Inngest background job
// and the user-triggered action share one implementation.
export { fetchAndBackfillPRs } from './github-sync-helpers';
export type { GitHubPR, GitHubSearchItem } from './github-sync-helpers';

export type SyncOutput = {
  merges: number;
  streak: number;
};

export async function syncGitHubStats(): Promise<Result<SyncOutput>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'Auth not configured');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'Sign in first');

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'Service role not configured');

  const { data: profile } = await service
    .from('profiles')
    .select('github_handle')
    .eq('id', user.id)
    .single();
  if (!profile) return err('no_profile', 'Profile not found');

  // Find the GitHub App installation — install token does not expire after
  // 1h like the OAuth provider_token, so it's the stable auth source.
  const { data: installRows } = await service
    .from('github_installations')
    .select('id')
    .eq('user_id', user.id)
    .is('uninstalled_at', null)
    .order('installed_at', { ascending: false })
    .limit(1);

  const installId = (installRows as { id: number }[] | null)?.[0]?.id;
  if (!installId) {
    return err(
      'no_installation',
      'No GitHub App installation found. Install the GitHub App first.',
    );
  }

  try {
    const octokit = await getInstallOctokit(installId);

    const [merges, streak, calendar] = await Promise.all([
      fetchMergedCount(octokit, profile.github_handle),
      fetchContributionStreak(octokit, profile.github_handle),
      fetchContributionCalendar(octokit, profile.github_handle),
      fetchAndBackfillPRs(service, user.id, profile.github_handle, installId),
    ]);

    await cacheSet(`gh:contrib:${user.id}`, { days: calendar }, 86_400);

    await service
      .from('profiles')
      .update({
        github_total_merges: merges,
        github_streak: streak,
        github_stats_synced_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    await cacheDel(`gh:dashboard:${user.id}`);
    await cacheDel(`profile:v3:${profile.github_handle}`);
    await cacheDel(`myprs:${user.id}`);
    await cacheDel(`myprs:sync:${user.id}`);

    return ok({ merges, streak });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return err('rate_limited', 'GitHub rate limit reached. Try again shortly.', true);
    }
    return err('github_api_error', `GitHub API error: ${msg}`, true);
  }
}
