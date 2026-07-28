'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallationToken } from '@/lib/github/app';
import { cacheDel, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import {
  fetchMergedCount,
  fetchContributionStreak,
  fetchContributionCalendar,
} from './github-sync-helpers';

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

export type GitHubSearchItem = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  pull_request?: { merged_at: string | null; url: string };
  repository_url: string;
};

export type SyncOutput = {
  merges: number;
  streak: number;
};

export async function fetchAndBackfillPRs(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string,
  githubHandle: string,
  installId: number | null,
): Promise<GitHubPR[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (installId) {
    try {
      const token = await getInstallationToken(installId);
      headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // proceed without auth — public PRs still visible
    }
  }

  // Fetch up to 100 PRs authored by this user across all of GitHub
  const url = `https://api.github.com/search/issues?q=is:pr+author:${encodeURIComponent(githubHandle)}&sort=created&order=desc&per_page=100`;
  let items: GitHubSearchItem[] = [];
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = (await res.json()) as { items?: GitHubSearchItem[] };
      items = data.items ?? [];
    }
  } catch {
    return [];
  }

  if (items.length === 0) return [];

  // Map to pull_requests row shape
  const rows = items.map((item) => {
    const repoFullName = item.repository_url.replace('https://api.github.com/repos/', '');
    const mergedAt = item.pull_request?.merged_at ?? null;
    const state: 'open' | 'closed' | 'merged' = mergedAt
      ? 'merged'
      : item.state === 'open'
        ? 'open'
        : 'closed';

    return {
      github_pr_id: item.id,
      repo_full_name: repoFullName,
      number: item.number,
      title: item.title,
      author_login: githubHandle,
      author_user_id: userId,
      state,
      url: item.html_url,
      github_created_at: item.created_at,
      github_updated_at: item.updated_at ?? item.created_at,
      merged_at: mergedAt,
    };
  });

  // Upsert into pull_requests so webhook-future events will also exist
  await service
    .from('pull_requests')
    .upsert(rows, { onConflict: 'github_pr_id', ignoreDuplicates: false });

  // Re-query to get DB-assigned ids
  const { data: saved } = await service
    .from('pull_requests')
    .select(
      'id, github_pr_id, repo_full_name, number, title, state, url, github_created_at, merged_at',
    )
    .eq('author_user_id', userId)
    .order('github_created_at', { ascending: false });

  return (saved ?? []) as GitHubPR[];
}

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

    const [merges, streak, calendar] = await Promise.all([
      fetchMergedCount(token, profile.github_handle),
      fetchContributionStreak(token, profile.github_handle),
      fetchContributionCalendar(token, profile.github_handle),
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
