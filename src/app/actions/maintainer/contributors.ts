'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';

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

  // Pull PRs scoped to this installation's repos.
  type RawPr = {
    author_user_id: string | null;
    state: 'open' | 'closed' | 'merged';
    mentor_verified: boolean;
    repo_full_name: string;
  };
  const { data: prsRaw } = await service
    .from('pull_requests')
    .select('author_user_id, state, mentor_verified, repo_full_name')
    .in('repo_full_name', repos);
  const prs = (prsRaw ?? []) as unknown as RawPr[];

  // Aggregate per contributor from PR rows.
  const mergedCount = new Map<string, number>();
  const inReviewCount = new Map<string, number>();
  const reposByUser = new Map<string, Set<string>>();

  for (const pr of prs) {
    if (!pr.author_user_id) continue;
    const uid = pr.author_user_id;
    if (!reposByUser.has(uid)) reposByUser.set(uid, new Set());
    reposByUser.get(uid)!.add(pr.repo_full_name);

    if (pr.state === 'merged') {
      mergedCount.set(uid, (mergedCount.get(uid) ?? 0) + 1);
    }
    if (pr.state === 'open' && !pr.mentor_verified) {
      inReviewCount.set(uid, (inReviewCount.get(uid) ?? 0) + 1);
    }
  }

  const userIds = Array.from(reposByUser.keys());
  if (userIds.length === 0) {
    return ok([]);
  }

  // Profiles for handle/level/xp.
  const { data: profileRows } = await service
    .from('profiles')
    .select('id, github_handle, level, xp')
    .in('id', userIds);

  // Last active timestamp: latest xp_events.created_at per user.
  const { data: xpRows } = await service
    .from('xp_events')
    .select('user_id, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  const lastActiveByUser = new Map<string, string>();
  for (const row of xpRows ?? []) {
    if (!lastActiveByUser.has(row.user_id)) {
      lastActiveByUser.set(row.user_id, row.created_at);
    }
  }

  // Issues solved: count of issue_authored_closed xp events per user.
  const { data: solvedRows } = await service
    .from('xp_events')
    .select('user_id')
    .in('user_id', userIds)
    .eq('source', 'issue_authored_closed');

  const solvedCount = new Map<string, number>();
  for (const row of solvedRows ?? []) {
    solvedCount.set(row.user_id, (solvedCount.get(row.user_id) ?? 0) + 1);
  }

  const rows: ContributorListRow[] = (profileRows ?? []).map((p) => ({
    userId: p.id,
    handle: p.github_handle,
    level: p.level ?? 0,
    xp: p.xp ?? 0,
    mergedPrs: mergedCount.get(p.id) ?? 0,
    inReview: inReviewCount.get(p.id) ?? 0,
    issuesSolved: solvedCount.get(p.id) ?? 0,
    lastActiveAt: lastActiveByUser.get(p.id) ?? null,
    repoFullNames: Array.from(reposByUser.get(p.id) ?? []),
  }));

  return ok(rows);
}
