'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallationToken } from '@/lib/github/app';
import { cacheDel } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import { fetchMergedCount, fetchContributionStreak } from './github-sync-helpers';

export type GitHubPR = {
  id: number;
  github_pr_id: number;
  repo_full_name: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  github_created_at: string;
  merged_at: string | null;
};

export type SyncOutput = {
  merges: number;
  streak: number;
};

export async function syncGitHubStats(): Promise<Result<SyncOutput>> {
  const sb = getServerSupabase();
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

  // Get the GitHub App installation token — does not expire after 1h like provider_token
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
    const token = await getInstallationToken(installId);

    const [merges, streak] = await Promise.all([
      fetchMergedCount(token, profile.github_handle),
      fetchContributionStreak(token, profile.github_handle),
    ]);

    await service
      .from('profiles')
      .update({
        github_total_merges: merges,
        github_streak: streak,
        github_stats_synced_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    await cacheDel(`gh:dashboard:${user.id}`);

    return ok({ merges, streak });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return err('rate_limited', 'GitHub rate limit reached. Try again shortly.', true);
    }
    return err('github_api_error', `GitHub API error: ${msg}`, true);
  }
}
