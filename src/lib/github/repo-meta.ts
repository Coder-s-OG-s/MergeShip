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

/**
 * Fetch + cache repo meta. Falls back to a sensible default if any API
 * call fails so the sweep never blocks on a flaky repo.
 */
export async function fetchRepoHealthInput(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoHealthInput> {
  const cacheKey = `gh:repo-health:${owner}/${repo}`;
  const cached = await cacheGet<RepoHealthInput>(cacheKey);
  if (cached) return cached;

  const fallback: RepoHealthInput = {
    stars: 0,
    recentCommits30d: 0,
    hasContributingMd: false,
    hasLicense: false,
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

    const mapped = mapRepoMeta(meta, { recentCommits30d, hasContributingMd });
    await cacheSet(cacheKey, mapped, META_TTL_S);
    return mapped;
  } catch {
    return fallback;
  }
}
