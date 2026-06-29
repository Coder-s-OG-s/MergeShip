'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { tryGetDb } from '@/lib/db/client';
import { profiles, xpEvents, pullRequests } from '@/lib/db/schema';
import { eq, inArray, sum, desc, and, count } from 'drizzle-orm';
import { cacheGet, cacheSet } from '@/lib/cache';
import type { MaintainerAnalyticsTrends } from '@/lib/maintainer/analytics';
import {
  comparePrRows,
  validateFilters,
  type MaintainerPrRow,
  type QueueFilters,
} from '@/lib/maintainer/queue';
import {
  type RepoHealthRow,
  type StaleIssueRow,
  type ContributorRow,
  type ReviewerLoadRow,
} from './types';

export async function getRepoHealthOverview(args: {
  installationId: number;
}): Promise<Result<RepoHealthRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const repoNames = repos;

  const { data: issues, error } = await service
    .from('issues')
    .select('repo_full_name, repo_health_score')
    .in('repo_full_name', repoNames);

  if (error) {
    return err('query_failed', error.message);
  }

  const healthMap = new Map<string, number[]>();

  for (const issue of issues ?? []) {
    const repo = issue.repo_full_name;
    if (!healthMap.has(repo)) {
      healthMap.set(repo, []);
    }
    healthMap.get(repo)?.push(issue.repo_health_score ?? 0);
  }

  return ok(
    repoNames.map((repo) => {
      const scores = healthMap.get(repo) ?? [];
      const average =
        scores.length > 0
          ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : 0;

      return {
        repoFullName: repo,
        repoHealthScore: average,
        updatedAt: new Date().toISOString(),
      };
    }),
  );
}

export async function getStaleIssues(args: {
  installationId: number;
}): Promise<Result<StaleIssueRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const repoNames = repos;
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: issues, error } = await service
    .from('issues')
    .select('id, title, repo_full_name, github_created_at, assignee_login')
    .eq('state', 'open')
    .in('repo_full_name', repoNames)
    .lt('github_created_at', fourteenDaysAgo.toISOString());

  if (error) {
    return err('query_failed', error.message);
  }

  return ok(
    (issues ?? []).map((issue) => {
      const created = new Date(issue.github_created_at ?? Date.now());
      const diffMs = Date.now() - created.getTime();

      return {
        id: issue.id,
        title: issue.title,
        repoFullName: issue.repo_full_name,
        daysStale: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
        claimed: Boolean(issue.assignee_login),
      };
    }),
  );
}

export async function getTopContributors(args: {
  installationId: number;
}): Promise<Result<ContributorRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const db = tryGetDb();
  if (!db) {
    return err('not_configured', 'database not configured');
  }

  try {
    const rows = await db
      .select({
        githubHandle: profiles.githubHandle,
        level: profiles.level,
        xp: sum(xpEvents.xpDelta),
      })
      .from(xpEvents)
      .innerJoin(profiles, eq(xpEvents.userId, profiles.id))
      .where(inArray(xpEvents.repo, repos))
      .groupBy(profiles.id, profiles.githubHandle, profiles.level)
      .orderBy(desc(sum(xpEvents.xpDelta)))
      .limit(5);

    return ok(
      rows.map((row) => ({
        githubHandle: row.githubHandle ?? 'unknown',
        xp: row.xp ? Number(row.xp) : 0,
        level: row.level ?? 0,
      })),
    );
  } catch (error: any) {
    return err('query_failed', error.message || 'Drizzle query failed');
  }
}

export async function getMaintainerAnalyticsTrends(args: {
  installationId: number;
}): Promise<Result<MaintainerAnalyticsTrends>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer:analytics', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ weekly: [], levelDistribution: [] });
  }

  const cacheKey = `maint:analytics-trends:${user.id}:${args.installationId}`;
  const cached = await cacheGet<MaintainerAnalyticsTrends>(cacheKey);
  if (cached) return ok(cached);

  const { data, error } = await service.rpc('maintainer_analytics_trends', {
    repo_names: repos,
  });

  if (error) return err('query_failed', error.message);

  const trends = normaliseAnalyticsTrends(data);
  await cacheSet(cacheKey, trends, 30 * 60);
  return ok(trends);
}

function normaliseAnalyticsTrends(value: unknown): MaintainerAnalyticsTrends {
  if (!value || typeof value !== 'object') {
    return { weekly: [], levelDistribution: [] };
  }

  const data = value as Partial<MaintainerAnalyticsTrends>;
  return {
    weekly: Array.isArray(data.weekly) ? data.weekly : [],
    levelDistribution: Array.isArray(data.levelDistribution) ? data.levelDistribution : [],
  };
}

export async function exportPrQueueCsv(
  installationId: number,
  filters?: Partial<QueueFilters>,
): Promise<Result<string>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:csv', ...RATE_LIMIT_TIERS.STRICT },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok('');
  }

  const validFilters = validateFilters(filters ?? {});

  const scopedRepos =
    validFilters.repos.length > 0 ? repos.filter((r) => validFilters.repos.includes(r)) : repos;
  if (scopedRepos.length === 0) {
    return ok('');
  }

  let q = service
    .from('pull_requests')
    .select(
      'id, repo_full_name, number, title, url, state, draft, author_login, ' +
        'author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at',
    )
    .in('repo_full_name', scopedRepos);

  if (validFilters.state.length > 0) q = q.in('state', validFilters.state);
  if (validFilters.mentorVerified === 'yes') q = q.eq('mentor_verified', true);
  else if (validFilters.mentorVerified === 'no') q = q.eq('mentor_verified', false);

  type RawPr = {
    id: number;
    repo_full_name: string;
    number: number;
    title: string;
    url: string;
    state: 'open' | 'closed' | 'merged';
    draft: boolean;
    author_login: string;
    author_user_id: string | null;
    mentor_verified: boolean;
    mentor_reviewer_id: string | null;
    github_updated_at: string;
  };

  const { data: prs } = await q.order('github_updated_at', { ascending: false }).limit(1000);
  const prRows = (prs ?? []) as unknown as RawPr[];

  const authorIds = Array.from(
    new Set(prRows.map((r) => r.author_user_id).filter((id): id is string => !!id)),
  );
  const mentorIds = Array.from(
    new Set(prRows.map((r) => r.mentor_reviewer_id).filter((id): id is string => !!id)),
  );

  const profilesById = new Map<
    string,
    { handle: string; level: number; xp: number; mergedPrs: number }
  >();

  const ids = Array.from(new Set([...authorIds, ...mentorIds]));
  if (ids.length > 0) {
    const { data: profileRows } = await service
      .from('profiles')
      .select('id, github_handle, level, xp')
      .in('id', ids);
    const merged = await service
      .from('xp_events')
      .select('user_id')
      .in('user_id', ids)
      .eq('source', 'recommended_merge');
    const mergedCount = new Map<string, number>();
    for (const row of merged.data ?? []) {
      mergedCount.set(row.user_id, (mergedCount.get(row.user_id) ?? 0) + 1);
    }
    for (const p of profileRows ?? []) {
      profilesById.set(p.id, {
        handle: p.github_handle,
        level: p.level ?? 0,
        xp: p.xp ?? 0,
        mergedPrs: mergedCount.get(p.id) ?? 0,
      });
    }
  }

  let rows: MaintainerPrRow[] = prRows.map((r) => {
    const author = r.author_user_id ? (profilesById.get(r.author_user_id) ?? null) : null;
    const mentor = r.mentor_reviewer_id ? (profilesById.get(r.mentor_reviewer_id) ?? null) : null;
    return {
      id: r.id,
      repoFullName: r.repo_full_name,
      number: r.number,
      title: r.title,
      url: r.url,
      state: r.state as 'open' | 'closed' | 'merged',
      draft: r.draft,
      authorLogin: r.author_login,
      authorUserId: r.author_user_id,
      authorLevel: author?.level ?? null,
      authorXp: author?.xp ?? null,
      authorMergedPrs: author?.mergedPrs ?? null,
      mentorVerified: r.mentor_verified,
      mentorReviewerHandle: mentor?.handle ?? null,
      mentorReviewerLevel: mentor?.level ?? null,
      githubUpdatedAt: r.github_updated_at,
    };
  });

  if (validFilters.authorLevel.length > 0) {
    rows = rows.filter((row) => validFilters.authorLevel.includes(row.authorLevel ?? 0));
  }

  rows.sort(comparePrRows);

  const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
  const header = [
    'PR #',
    'Title',
    'Author',
    'Author Level',
    'Verified',
    'Repo',
    'Age (days)',
    'URL',
  ];
  const csvLines = [header.join(',')];

  const now = Date.now();
  for (const r of rows) {
    const ageDays = Math.floor(
      (now - new Date(r.githubUpdatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const line = [
      r.number.toString(),
      escapeCsv(r.title),
      r.authorLogin,
      r.authorLevel !== null ? r.authorLevel.toString() : '',
      r.mentorVerified ? 'Yes' : 'No',
      r.repoFullName,
      ageDays.toString(),
      r.url,
    ];
    csvLines.push(line.join(','));
  }

  return ok(csvLines.join('\n'));
}

export async function getReviewerLoad(args: {
  installationId: number;
}): Promise<Result<ReviewerLoadRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const db = tryGetDb();
  if (!db) {
    return err('not_configured', 'database not configured');
  }

  try {
    const rows = await db
      .select({
        reviewerId: pullRequests.mentorReviewerId,
        githubHandle: profiles.githubHandle,
        avatarUrl: profiles.avatarUrl,
        prCount: count(pullRequests.id),
      })
      .from(pullRequests)
      .innerJoin(profiles, eq(pullRequests.mentorReviewerId, profiles.id))
      .where(
        and(
          inArray(pullRequests.repoFullName, repos),
          eq(pullRequests.state, 'open'),
          eq(pullRequests.mentorVerified, false),
        ),
      )
      .groupBy(
        pullRequests.mentorReviewerId,
        profiles.id,
        profiles.githubHandle,
        profiles.avatarUrl,
      )
      .orderBy(desc(count(pullRequests.id)));

    return ok(
      rows.map((row) => ({
        reviewerId: row.reviewerId as string,
        githubHandle: row.githubHandle,
        avatarUrl: row.avatarUrl,
        prCount: row.prCount,
      })),
    );
  } catch (error: any) {
    return err('query_failed', error.message || 'Drizzle query failed');
  }
}
