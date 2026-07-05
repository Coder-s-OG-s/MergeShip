'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { getInstallOctokit } from '@/lib/github/app';
import { computeTrustScore } from '@/lib/maintainer/trust';

export type ContributorListRow = {
  userId: string;
  handle: string;
  level: number;
  xp: number;
  mergedPrs: number;
  inReview: number;
  issuesSolved: number;
  lastActiveAt: string | null;
  repoFullNames: string[];
  trustScore: number;
  aiFlaggedPrCount: number;
};

export async function getContributorsList(
  installationId: number,
): Promise<Result<ContributorListRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:contributors', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  // Grouped counts (state + mentor_verified + ai_flagged) per author, aggregated in
  // Postgres via PostgREST's count() so we never pull raw PR rows and hit
  // the default 1000-row truncation on large installs.
  type PrAggRow = {
    author_user_id: string | null;
    state: 'open' | 'closed' | 'merged';
    mentor_verified: boolean;
    ai_flagged: boolean;
    count: number;
  };
  const { data: prAggRaw } = await service
    .from('pull_requests')
    .select('author_user_id, state, mentor_verified, ai_flagged, count:id.count()')
    .in('repo_full_name', repos)
    .not('author_user_id', 'is', null);
  const prAgg = (prAggRaw ?? []) as unknown as PrAggRow[];

  const mergedCount = new Map<string, number>();
  const inReviewCount = new Map<string, number>();
  const aiFlaggedCount = new Map<string, number>();
  const userIdsSet = new Set<string>();

  for (const row of prAgg) {
    if (!row.author_user_id) continue;
    userIdsSet.add(row.author_user_id);
    if (row.state === 'merged') {
      mergedCount.set(row.author_user_id, (mergedCount.get(row.author_user_id) ?? 0) + row.count);
    }
    if (row.state === 'open' && !row.mentor_verified) {
      inReviewCount.set(
        row.author_user_id,
        (inReviewCount.get(row.author_user_id) ?? 0) + row.count,
      );
    }
    if (row.ai_flagged) {
      aiFlaggedCount.set(
        row.author_user_id,
        (aiFlaggedCount.get(row.author_user_id) ?? 0) + row.count,
      );
    }
  }

  // repoFullNames per contributor: distinct (author, repo) pairs, grouped
  // in Postgres too (no row is returned twice per author+repo combo).
  type RepoAggRow = { author_user_id: string | null; repo_full_name: string };
  const { data: repoAggRaw } = await service
    .from('pull_requests')
    .select('author_user_id, repo_full_name')
    .in('repo_full_name', repos)
    .not('author_user_id', 'is', null);
  const reposByUser = new Map<string, Set<string>>();
  for (const row of (repoAggRaw ?? []) as unknown as RepoAggRow[]) {
    if (!row.author_user_id) continue;
    if (!reposByUser.has(row.author_user_id)) reposByUser.set(row.author_user_id, new Set());
    reposByUser.get(row.author_user_id)!.add(row.repo_full_name);
    userIdsSet.add(row.author_user_id);
  }

  const userIds = Array.from(userIdsSet);
  if (userIds.length === 0) {
    return ok([]);
  }

  const { data: profileRows } = await service
    .from('profiles')
    .select('id, github_handle, level, xp, github_streak')
    .in('id', userIds);

  // Last active: DB-side MAX(created_at) grouped by user_id, instead of
  // fetching every xp_events row and deduping in JS.
  type LastActiveRow = { user_id: string; last_active: string | null };
  const { data: lastActiveRaw } = await service
    .from('xp_events')
    .select('user_id, last_active:created_at.max()')
    .in('user_id', userIds);
  const lastActiveByUser = new Map<string, string>();
  for (const row of (lastActiveRaw ?? []) as unknown as LastActiveRow[]) {
    if (row.last_active) lastActiveByUser.set(row.user_id, row.last_active);
  }

  // Issues solved: DB-side count grouped by user_id.
  type SolvedRow = { user_id: string; count: number };
  const { data: solvedRaw } = await service
    .from('xp_events')
    .select('user_id, count:id.count()')
    .in('user_id', userIds)
    .eq('source', 'issue_authored_closed');
  const solvedCount = new Map<string, number>();
  for (const row of (solvedRaw ?? []) as unknown as SolvedRow[]) {
    solvedCount.set(row.user_id, row.count);
  }

  const rows: ContributorListRow[] = (profileRows ?? []).map((p) => {
    const aiFlaggedPrCount = aiFlaggedCount.get(p.id) ?? 0;
    const mergedPrs = mergedCount.get(p.id) ?? 0;
    const issuesSolved = solvedCount.get(p.id) ?? 0;
    const githubStreak = p.github_streak ?? 0;

    const trustScore = computeTrustScore({
      level: p.level ?? 0,
      mergedPrs,
      issuesSolved,
      githubStreak,
      aiFlaggedPrCount,
    });

    return {
      userId: p.id,
      handle: p.github_handle,
      level: p.level ?? 0,
      xp: p.xp ?? 0,
      mergedPrs,
      inReview: inReviewCount.get(p.id) ?? 0,
      issuesSolved,
      lastActiveAt: lastActiveByUser.get(p.id) ?? null,
      repoFullNames: Array.from(reposByUser.get(p.id) ?? []),
      trustScore,
      aiFlaggedPrCount,
    };
  });

  rows.sort((a, b) => b.xp - a.xp);

  return ok(rows);
}

export async function removeContributorFromOrg(
  installationId: number,
  targetHandle: string,
): Promise<Result<void>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:remove-contributor', ...RATE_LIMIT_TIERS.HOURLY },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Confirm the caller actually maintains this install.
  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return err('not_authorised', 'not your install');
  }

  const { data: install } = await service
    .from('github_installations')
    .select('account_type, account_login')
    .eq('id', installationId)
    .maybeSingle();
  if (!install) {
    return err('not_found', 'installation not found');
  }
  if (install.account_type !== 'Organization') {
    return err('not_organization', 'Cannot remove a contributor from a personal account install');
  }

  try {
    const octokit = await getInstallOctokit(installationId);
    await octokit.orgs.removeMember({ org: install.account_login, username: targetHandle });
  } catch (e) {
    return err('github_api_failed', 'Failed to remove contributor from org');
  }

  return ok(undefined);
}
