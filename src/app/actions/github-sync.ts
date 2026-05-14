'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheDel } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';

export type GitHubPR = {
  id: string;
  title: string;
  repo_full_name: string;
  state: 'open' | 'closed' | 'merged';
  pr_number: number;
  pr_url: string;
  opened_at: string;
};

export type SyncOutput = {
  merges: number;
  streak: number;
  prs: GitHubPR[];
};

// Pure helper — exported for testing.
export function parsePRState(
  apiState: string,
  mergedAt: string | null,
): 'open' | 'closed' | 'merged' {
  if (mergedAt != null) return 'merged';
  if (apiState === 'open') return 'open';
  return 'closed';
}

// Pure helper — exported for testing.
// days: array from GraphQL contributionDays (any order, any date range).
// today: YYYY-MM-DD string representing the current date.
export function calculateStreak(
  days: { date: string; contributionCount: number }[],
  today: string,
): number {
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
  return d.toISOString().split('T')[0];
}

async function fetchMergedCount(token: string, handle: string): Promise<number> {
  const res = await fetch(
    `https://api.github.com/search/issues?q=is:pr+is:merged+author:${handle}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub Search API ${res.status}`);
  const data = (await res.json()) as { total_count: number };
  return data.total_count;
}

async function fetchContributionStreak(token: string, login: string): Promise<number> {
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

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { login, from: from.toISOString(), to: to.toISOString() },
    }),
  });

  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      };
    };
  };

  const weeks = json.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const days = weeks.flatMap((w) => w.contributionDays);
  const today = new Date().toISOString().split('T')[0];
  return calculateStreak(days, today);
}

async function fetchAllPRs(token: string, handle: string): Promise<GitHubPR[]> {
  const allPRs: GitHubPR[] = [];
  const maxPages = 3;

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `https://api.github.com/search/issues?q=is:pr+author:${handle}&sort=updated&per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (!res.ok) throw new Error(`GitHub Search API ${res.status}`);
    const data = (await res.json()) as {
      items: {
        node_id: string;
        title: string;
        number: number;
        html_url: string;
        state: string;
        repository_url: string;
        created_at: string;
        pull_request?: { merged_at: string | null };
      }[];
    };

    for (const item of data.items) {
      const repoFullName = item.repository_url.replace('https://api.github.com/repos/', '');
      const state = parsePRState(item.state, item.pull_request?.merged_at ?? null);
      allPRs.push({
        id: item.node_id,
        title: item.title,
        repo_full_name: repoFullName,
        state,
        pr_number: item.number,
        pr_url: item.html_url,
        opened_at: item.created_at,
      });
    }

    if (data.items.length < 100) break;
  }

  return allPRs;
}

export async function syncGitHubStats(): Promise<Result<SyncOutput>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'Auth not configured');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'Sign in first');

  const sessionRes = await sb.auth.getSession();
  const providerToken = sessionRes.data.session?.provider_token;
  if (!providerToken) {
    return err('no_token', 'GitHub token unavailable. Sign out and sign in again.', true);
  }

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'Service role not configured');

  const { data: profile } = await service
    .from('profiles')
    .select('github_handle')
    .eq('id', user.id)
    .single();
  if (!profile) return err('no_profile', 'Profile not found');

  try {
    const [merges, streak, prs] = await Promise.all([
      fetchMergedCount(providerToken, profile.github_handle),
      fetchContributionStreak(providerToken, profile.github_handle),
      fetchAllPRs(providerToken, profile.github_handle),
    ]);

    await service
      .from('profiles')
      .update({
        github_total_merges: merges,
        github_streak: streak,
        github_stats_synced_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Replace all PRs: delete existing then insert fresh batch
    await service.from('github_prs').delete().eq('user_id', user.id);
    if (prs.length > 0) {
      await service.from('github_prs').insert(prs.map((pr) => ({ ...pr, user_id: user.id })));
    }

    await cacheDel(`gh:dashboard:${user.id}`);

    return ok({ merges, streak, prs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return err('rate_limited', 'GitHub rate limit reached. Try again shortly.', true);
    }
    return err('github_api_error', `GitHub API error: ${msg}`, true);
  }
}
