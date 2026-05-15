import type { Octokit } from '@octokit/rest';
import type { RepoHealthInput } from '../pipeline/score';
import { cacheGet, cacheSet } from '../cache';

/**
 * Repo meta fetch + map for the recommendation pipeline. issues-sweep
 * currently passes hardcoded values to repoHealth, making the ranker
 * ignore real differences between active and dead repos. This module
 * pulls the actual signals from one repos.get call (cached) and a
 * lightweight commit-count probe.
 */

export type RepoMetaResponse = {
  stargazers_count: number;
  pushed_at: string | null;
  license: { spdx_id: string | null } | null;
  language?: string | null;
};

export function mapRepoMeta(
  meta: RepoMetaResponse,
  extras: { recentCommits30d: number; recentMergedPrs30d?: number; hasContributingMd?: boolean },
): RepoHealthInput {
  const license = meta.license;
  return {
    stars: Math.max(0, meta.stargazers_count ?? 0),
    recentCommits30d: extras.recentCommits30d,
    recentMergedPrs30d: extras.recentMergedPrs30d,
    hasContributingMd: extras.hasContributingMd === true,
    hasLicense: Boolean(license && license.spdx_id),
  };
}

const META_TTL_S = 60 * 60 * 24; // 24h — repo meta changes slowly

export type RepoMetrics = RepoHealthInput & { language: string | null };

/**
 * Fetch + cache repo meta. Falls back to a sensible default if any API
 * call fails so the sweep never blocks on a flaky repo. Returns the
 * RepoHealthInput shape plus the primary language so the rec ranker
 * can mark language matches.
 */
export async function fetchRepoMetrics(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoMetrics> {
  const cacheKey = `gh:repo-metrics:${owner}/${repo}`;
  const cached = await cacheGet<RepoMetrics>(cacheKey);
  if (cached) return cached;

  const fallback: RepoMetrics = {
    stars: 0,
    recentCommits30d: 0,
    hasContributingMd: false,
    hasLicense: false,
    language: null,
  };

  try {
    const [metaRes, commitsRes, contributingRes] = await Promise.allSettled([
      octokit.repos.get({ owner, repo }),
      octokit.repos.listCommits({
        owner,
        repo,
        since: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        per_page: 100,
      }),
      octokit.repos
        .getContent({ owner, repo, path: 'CONTRIBUTING.md' })
        .then(() => true)
        .catch(() => false),
    ]);

    if (metaRes.status !== 'fulfilled') return fallback;
    const meta = metaRes.value.data as unknown as RepoMetaResponse;

    const recentCommits30d =
      commitsRes.status === 'fulfilled' ? (commitsRes.value.data?.length ?? 0) : 0;
    const hasContributingMd =
      contributingRes.status === 'fulfilled' ? contributingRes.value === true : false;

    const health = mapRepoMeta(meta, { recentCommits30d, hasContributingMd });
    const out: RepoMetrics = { ...health, language: meta.language ?? null };
    await cacheSet(cacheKey, out, META_TTL_S);
    return out;
  } catch {
    return fallback;
  }
}

/**
 * Backwards-compatible alias for callers that just want the health
 * input shape. Internally uses fetchRepoMetrics so the cache is shared.
 */
export async function fetchRepoHealthInput(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoHealthInput> {
  const { language: _ignored, ...health } = await fetchRepoMetrics(octokit, owner, repo);
  return health;
}
