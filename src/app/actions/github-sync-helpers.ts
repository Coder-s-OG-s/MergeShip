import type { Octokit } from '@octokit/rest';
import type { ContributionDay } from '@/lib/contributions/activity-history';
import { getInstallOctokit } from '@/lib/github/app';
import { getServiceSupabase } from '@/lib/supabase/service';

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
  additions?: number | null;
  deletions?: number | null;
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

export function parsePRState(
  apiState: string,
  mergedAt: string | null,
): 'open' | 'closed' | 'merged' {
  if (mergedAt != null) return 'merged';
  if (apiState === 'open') return 'open';
  return 'closed';
}

export function calculateStreak(days: ContributionDay[], today: string): number {
  const sorted = [...days]
    .filter((d) => d.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  let expectingDate: string | null = null;

  for (const day of sorted) {
    if (expectingDate === null) {
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        expectingDate = prevDay(day.date);
        continue;
      }
    } else {
      if (day.date !== expectingDate) break;
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        break;
      }
    }
  }

  return streak;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * All GitHub traffic is routed through Octokit (hard rule in
 * src/lib/github/app.ts) so tokens, rate-budget tracking, and secondary
 * rate-limit backoff stay centralized. Search API quota is a separate, tighter
 * bucket than the core budget — the x-ratelimit-* headers on these responses
 * are still parsed and recorded by the getInstallOctokit hook.
 */
export async function fetchMergedCount(octokit: Octokit, handle: string): Promise<number> {
  const res = await octokit.search.issuesAndPullRequests({
    q: `is:pr is:merged author:${handle}`,
    per_page: 1,
  });
  return res.data.total_count;
}

export async function fetchContributionCalendar(
  octokit: Octokit,
  login: string,
): Promise<ContributionDay[]> {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const result = (await octokit.graphql(query, {
    login,
    from: from.toISOString(),
    to: to.toISOString(),
  })) as {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          weeks: { contributionDays: ContributionDay[] }[];
        };
      };
    };
  };

  const weeks = result?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  return weeks.flatMap((w) => w.contributionDays);
}

export async function fetchContributionStreak(octokit: Octokit, login: string): Promise<number> {
  const days = await fetchContributionCalendar(octokit, login);
  const today = new Date().toISOString().slice(0, 10);
  return calculateStreak(days, today);
}

/**
 * Shared PR backfill used by both the user-triggered sync action and the
 * background github-stats-sync Inngest job, so behavior never diverges.
 *
 * Fails closed: an unusable installation id or a GitHub API failure throws
 * instead of silently degrading the sync.
 */
export async function fetchAndBackfillPRs(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string,
  githubHandle: string,
  installId: number | null,
): Promise<GitHubPR[]> {
  if (!installId) {
    throw new Error('No GitHub App installation id available to sync PRs');
  }
  const octokit = await getInstallOctokit(installId);

  // Fetch up to 100 PRs authored by this user across all of GitHub.
  const res = await octokit.search.issuesAndPullRequests({
    q: `is:pr author:${githubHandle}`,
    sort: 'created',
    order: 'desc',
    per_page: 100,
  });
  const items = (res.data.items ?? []) as GitHubSearchItem[];

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
      'id, github_pr_id, repo_full_name, number, title, state, url, github_created_at, merged_at, additions, deletions',
    )
    .eq('author_user_id', userId)
    .order('github_created_at', { ascending: false });

  return (saved ?? []) as GitHubPR[];
}
