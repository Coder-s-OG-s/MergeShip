'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { tryGetDb } from '@/lib/db/client';
import { profiles, xpEvents, pullRequests, githubInstallations, issues } from '@/lib/db/schema';
import { eq, inArray, sum, desc, and, count, gte, lte, isNotNull } from 'drizzle-orm';
import { computeTimeSaved, type TimeSavedBreakdown } from '@/lib/maintainer/time-saved';
import { cacheGet, cacheSet } from '@/lib/cache';
import type { MaintainerAnalyticsTrends } from '@/lib/maintainer/analytics';
import {
  comparePrRows,
  validateFilters,
  type MaintainerPrRow,
  type QueueFilters,
} from '@/lib/maintainer/queue';
import { xpForLevel, MAX_LEVEL } from '@/lib/xp/curve';
import type {
  RepoHealthRow,
  StaleIssueRow,
  ContributorRow,
  ReviewerLoadRow,
  NoiseBreakdown,
  PromotionEligibleRow,
  ContributorFunnelData,
} from './types';
import { type AnalyticsRange, rangeToDateBounds } from '@/lib/maintainer/analytics-range';

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

export type StalePrRow = {
  id: number;
  number: number;
  title: string;
  url: string;
  repoFullName: string;
  daysSinceUpdate: number;
  authorLogin: string;
};

export async function getStalePrs({
  installationId,
  thresholdDays = 14,
}: {
  installationId: number;
  thresholdDays?: number;
}): Promise<Result<StalePrRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

  const { data, error } = await service
    .from('pull_requests')
    .select('id, number, title, url, repo_full_name, github_updated_at, author_login')
    .in('repo_full_name', repos)
    .eq('state', 'open')
    .lt('github_updated_at', thresholdDate.toISOString())
    .order('github_updated_at', { ascending: true })
    .limit(5);

  if (error) return err('db_error', error.message);

  type RawStalePr = {
    id: number;
    number: number;
    title: string;
    url: string;
    repo_full_name: string;
    github_updated_at: string;
    author_login: string | null;
  };

  const rows: StalePrRow[] = ((data ?? []) as RawStalePr[]).map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    url: row.url,
    repoFullName: row.repo_full_name,
    daysSinceUpdate: Math.floor(
      (Date.now() - new Date(row.github_updated_at).getTime()) / 86_400_000,
    ),
    authorLogin: row.author_login ?? 'unknown',
  }));

  return ok(rows);
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
      rows.map((row: { githubHandle: string | null; xp: unknown; level: number | null }) => ({
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
  range?: AnalyticsRange;
}): Promise<Result<MaintainerAnalyticsTrends>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer:analytics', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ weekly: [], levelDistribution: [], avgReviewTimeHours: null });
  }

  const activeRange = args.range ?? '30d';
  const cacheKey = `maint:analytics-trends:${user.id}:${args.installationId}:${activeRange}`;
  const cached = await cacheGet<MaintainerAnalyticsTrends>(cacheKey);
  if (cached) return ok(cached);

  const { data, error } = await service.rpc('maintainer_analytics_trends', {
    repo_names: repos,
  });

  if (error) return err('query_failed', error.message);

  const { from, to } = rangeToDateBounds(activeRange, new Date());

  // Fetch average review time from pull_requests
  let q = service
    .from('pull_requests')
    .select('github_created_at, mentor_review_at')
    .in('repo_full_name', repos)
    .eq('mentor_verified', true)
    .not('mentor_review_at', 'is', null)
    .lte('github_created_at', to.toISOString());

  if (activeRange !== 'all') {
    q = q.gte('github_created_at', from.toISOString());
  }

  const { data: prs } = await q;

  let avgReviewTimeHours = null;
  if (prs && prs.length > 0) {
    const totalSeconds = (
      prs as { github_created_at: string; mentor_review_at: string | null }[]
    ).reduce((sum: number, pr) => {
      const created = new Date(pr.github_created_at).getTime();
      const reviewed = new Date(pr.mentor_review_at!).getTime();
      return sum + (reviewed - created) / 1000;
    }, 0);
    avgReviewTimeHours = totalSeconds / prs.length / 3600;
  }

  const trends = normaliseAnalyticsTrends(data, avgReviewTimeHours);
  await cacheSet(cacheKey, trends, 30 * 60);
  return ok(trends);
}

function normaliseAnalyticsTrends(
  value: unknown,
  avgReviewTimeHours: number | null,
): MaintainerAnalyticsTrends {
  if (!value || typeof value !== 'object') {
    return { weekly: [], levelDistribution: [], avgReviewTimeHours: null };
  }

  const data = value as Partial<MaintainerAnalyticsTrends>;
  return {
    weekly: Array.isArray(data.weekly) ? data.weekly : [],
    levelDistribution: Array.isArray(data.levelDistribution) ? data.levelDistribution : [],
    avgReviewTimeHours,
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
        'author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at, ai_flagged',
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
    ai_flagged: boolean;
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
      aiFlagged: r.ai_flagged,
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

export async function getPromotionEligible(args: {
  installationId: number;
}): Promise<Result<PromotionEligibleRow[]>> {
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

  // Fetch XP events in the installation repos to get the scoped user IDs
  const { data: eventRows, error: eventError } = await service
    .from('xp_events')
    .select('user_id')
    .in('repo', repos);
  if (eventError) return err('query_failed', eventError.message);
  const userIds = Array.from(
    new Set((eventRows ?? []).map((r) => r.user_id).filter((id): id is string => Boolean(id))),
  );

  if (userIds.length === 0) return ok([]);

  // Fetch profiles for those users
  const { data: profileRows, error: profileError } = await service
    .from('profiles')
    .select('github_handle, xp, level')
    .in('id', userIds);

  if (profileError) {
    return err('query_failed', profileError.message);
  }

  const eligible: PromotionEligibleRow[] = [];
  for (const p of profileRows ?? []) {
    const level: number = p.level ?? 0;
    const xp: number = p.xp ?? 0;

    // Skip contributors already at max level
    if (level >= MAX_LEVEL) continue;

    const nextThreshold = xpForLevel(level + 1);
    const gap = nextThreshold - xpForLevel(level);
    const triggerXp = nextThreshold - Math.floor(gap * 0.1);
    const xpNeeded = nextThreshold - xp;
    if (xp >= triggerXp && xpNeeded > 0) {
      eligible.push({
        githubHandle: p.github_handle ?? 'unknown',
        xp,
        level,
        xpNeeded,
      });
    }
  }

  return ok(eligible.sort((a, b) => a.xpNeeded - b.xpNeeded).slice(0, 10));
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
      rows.map(
        (row: {
          reviewerId: string | null;
          githubHandle: string;
          avatarUrl: string | null;
          prCount: number;
        }) => ({
          reviewerId: row.reviewerId as string,
          githubHandle: row.githubHandle,
          avatarUrl: row.avatarUrl,
          prCount: row.prCount,
        }),
      ),
    );
  } catch (error: any) {
    return err('query_failed', error.message || 'Drizzle query failed');
  }
}

export async function getNoiseBreakdown(args: {
  installationId: number;
  range?: AnalyticsRange;
}): Promise<Result<NoiseBreakdown>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ valid: 0, spamAi: 0, other: 0, total: 0 });
  }

  const db = tryGetDb();
  if (!db) {
    return err('not_configured', 'database not configured');
  }

  const activeRange = args.range ?? '30d';
  const { from, to } = rangeToDateBounds(activeRange, new Date());

  try {
    let whereClause = and(
      inArray(pullRequests.repoFullName, repos),
      lte(pullRequests.githubCreatedAt, to),
    );

    if (activeRange !== 'all') {
      whereClause = and(
        inArray(pullRequests.repoFullName, repos),
        gte(pullRequests.githubCreatedAt, from),
        lte(pullRequests.githubCreatedAt, to),
      );
    }

    const rows = await db
      .select({
        aiFlagged: pullRequests.aiFlagged,
        state: pullRequests.state,
        cnt: count(pullRequests.id),
      })
      .from(pullRequests)
      .where(whereClause)
      .groupBy(pullRequests.aiFlagged, pullRequests.state);

    let spamAi = 0;
    let other = 0;
    let valid = 0;

    for (const row of rows) {
      const n = row.cnt;
      if (row.aiFlagged) {
        spamAi += n;
      } else if (row.state === 'closed') {
        // closed-without-merge and not flagged → noise/other
        other += n;
      } else {
        valid += n;
      }
    }

    const total = spamAi + other + valid;
    return ok({ valid, spamAi, other, total });
  } catch (error: any) {
    return err('query_failed', error.message || 'Drizzle query failed');
  }
}

export async function getContributorFunnel(args: {
  installationId: number;
}): Promise<Result<ContributorFunnelData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ registered: 0, firstPr: 0, l2Promoted: 0 });
  }

  // registered: distinct profiles with any PR row for these repos
  const { data: regRows, error: regError } = await service
    .from('pull_requests')
    .select('author_user_id')
    .in('repo_full_name', repos)
    .not('author_user_id', 'is', null);
  if (regError) return err('query_failed', regError.message);
  const registered = new Set((regRows ?? []).map((r) => r.author_user_id)).size;

  // firstPr: distinct profiles with >= 1 merged PR
  const { data: mergedRows, error: mergedError } = await service
    .from('pull_requests')
    .select('author_user_id')
    .in('repo_full_name', repos)
    .eq('state', 'merged')
    .not('author_user_id', 'is', null);
  if (mergedError) return err('query_failed', mergedError.message);
  const firstPr = new Set((mergedRows ?? []).map((r) => r.author_user_id)).size;

  // l2Promoted: distinct profiles at level >= 2
  const userIds = Array.from(new Set((regRows ?? []).map((r) => r.author_user_id).filter(Boolean)));
  if (userIds.length === 0) return ok({ registered, firstPr, l2Promoted: 0 });

  const { data: profileRows, error: profileError } = await service
    .from('profiles')
    .select('id, level')
    .in('id', userIds)
    .gte('level', 2);
  if (profileError) return err('query_failed', profileError.message);
  const l2Promoted = (profileRows ?? []).length;

  return ok({ registered, firstPr, l2Promoted });
}

export async function getTimeSaved(
  installationId: number,
  range: AnalyticsRange,
): Promise<Result<TimeSavedBreakdown>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const db = tryGetDb();
  if (!db) {
    return err('not_configured', 'database not configured');
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok({
      aiFilteringHours: 0,
      chainReviewsHours: 0,
      autoTriageHours: 0,
      totalHours: 0,
      projectedAnnualHours: 0,
    });
  }

  let startDate: Date | null = null;
  let daysInRange = 0;

  if (range === '7d') {
    daysInRange = 7;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (range === '30d') {
    daysInRange = 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  } else if (range === '90d') {
    daysInRange = 90;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
  } else {
    // 'all'
    const install = await db
      .select({ installedAt: githubInstallations.installedAt })
      .from(githubInstallations)
      .where(eq(githubInstallations.id, installationId))
      .limit(1);

    if (install.length > 0 && install[0]?.installedAt) {
      const diffMs = Date.now() - new Date(install[0].installedAt).getTime();
      daysInRange = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    } else {
      daysInRange = 30; // fallback default
    }
  }

  try {
    // 1. ai_flagged_prs_blocked
    const aiFlaggedConditions = [
      inArray(pullRequests.repoFullName, repos),
      eq(pullRequests.aiFlagged, true),
    ];
    if (startDate) {
      aiFlaggedConditions.push(gte(pullRequests.githubCreatedAt, startDate));
    }
    const aiFlaggedResult = await db
      .select({ count: count() })
      .from(pullRequests)
      .where(and(...aiFlaggedConditions));
    const aiBlockedPrs = aiFlaggedResult[0]?.count ?? 0;

    // 2. mentor_verified_prs
    const mentorVerifiedConditions = [
      inArray(pullRequests.repoFullName, repos),
      eq(pullRequests.mentorVerified, true),
      eq(pullRequests.state, 'merged'),
    ];
    if (startDate) {
      mentorVerifiedConditions.push(gte(pullRequests.githubCreatedAt, startDate));
    }
    const mentorVerifiedResult = await db
      .select({ count: count() })
      .from(pullRequests)
      .where(and(...mentorVerifiedConditions));
    const mentorVerifiedPrs = mentorVerifiedResult[0]?.count ?? 0;

    // 3. auto_triaged_issues
    const autoTriagedConditions = [
      inArray(issues.repoFullName, repos),
      isNotNull(issues.assigneeLogin),
    ];
    if (startDate) {
      autoTriagedConditions.push(gte(issues.githubCreatedAt, startDate));
    }
    const autoTriagedResult = await db
      .select({ count: count() })
      .from(issues)
      .where(and(...autoTriagedConditions));
    const autoTriagedIssues = autoTriagedResult[0]?.count ?? 0;

    const breakdown = computeTimeSaved({
      aiBlockedPrs,
      mentorVerifiedPrs,
      autoTriagedIssues,
      daysInRange,
    });

    return ok(breakdown);
  } catch (error: any) {
    return err('query_failed', error.message || 'Drizzle query failed');
  }
}

export type RepoAnalyticsRow = {
  repoFullName: string;
  prsMerged: number;
  prsMergedDelta: number;
  avgReviewHours: number | null;
  aiBlocked: number;
  activeContributors: number;
  signalRate: number;
};

export async function getRepoAnalyticsBreakdown(
  installationId: number,
  range: AnalyticsRange,
): Promise<Result<RepoAnalyticsRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const now = new Date();
  const current = rangeToDateBounds(range, now);
  const diffMs = current.to.getTime() - current.from.getTime();

  let previous = null;
  if (range !== 'all') {
    previous = {
      from: new Date(current.from.getTime() - diffMs),
      to: new Date(current.from.getTime()),
    };
  }

  const fetchFrom = previous ? previous.from : current.from;

  const { data: prs, error } = await service
    .from('pull_requests')
    .select(
      'repo_full_name, state, author_user_id, ai_flagged, mentor_verified, github_created_at, mentor_review_at, github_updated_at, merged_at, closed_at',
    )
    .in('repo_full_name', repos)
    .gte('github_updated_at', fetchFrom.toISOString())
    .lte('github_updated_at', current.to.toISOString());

  if (error) {
    return err('query_failed', error.message);
  }

  type RepoStats = {
    currentMerged: number;
    prevMerged: number;
    aiBlocked: number;
    activeContributors: Set<string>;
    closedCount: number;
    reviewTimesHours: number[];
  };

  const repoStats = new Map<string, RepoStats>();
  for (const repo of repos) {
    repoStats.set(repo, {
      currentMerged: 0,
      prevMerged: 0,
      aiBlocked: 0,
      activeContributors: new Set(),
      closedCount: 0,
      reviewTimesHours: [],
    });
  }

  for (const pr of prs ?? []) {
    const stats = repoStats.get(pr.repo_full_name);
    if (!stats) continue;

    const prDate = new Date(pr.github_updated_at);
    const isCurrentActivity = prDate >= current.from && prDate <= current.to;

    if (pr.state === 'merged' && pr.merged_at) {
      const mergedDate = new Date(pr.merged_at);
      const isCurrentMerge = mergedDate >= current.from && mergedDate <= current.to;
      const isPrevMerge = previous
        ? mergedDate >= previous.from && mergedDate < current.from
        : false;

      if (isCurrentMerge) stats.currentMerged++;
      if (isPrevMerge) stats.prevMerged++;
    }

    if (pr.state === 'closed' && pr.closed_at) {
      const closedDate = new Date(pr.closed_at);
      const isCurrentClose = closedDate >= current.from && closedDate <= current.to;
      if (isCurrentClose) stats.closedCount++;
    }

    if (isCurrentActivity) {
      if (pr.ai_flagged) stats.aiBlocked++;
      if (pr.author_user_id) stats.activeContributors.add(pr.author_user_id);

      if (pr.mentor_verified && pr.mentor_review_at && pr.github_created_at) {
        const created = new Date(pr.github_created_at).getTime();
        const reviewed = new Date(pr.mentor_review_at).getTime();
        if (reviewed > created) {
          stats.reviewTimesHours.push((reviewed - created) / (1000 * 60 * 60));
        }
      }
    }
  }

  const resultRows: RepoAnalyticsRow[] = repos.map((repo) => {
    const stats = repoStats.get(repo)!;
    const totalClosedOrMerged = stats.currentMerged + stats.closedCount;
    const signalRate =
      totalClosedOrMerged > 0 ? (stats.currentMerged / totalClosedOrMerged) * 100 : 0;

    let avgReviewHours: number | null = null;
    if (stats.reviewTimesHours.length >= 3) {
      const sum = stats.reviewTimesHours.reduce((a, b) => a + b, 0);
      avgReviewHours = sum / stats.reviewTimesHours.length;
    }

    return {
      repoFullName: repo,
      prsMerged: stats.currentMerged,
      prsMergedDelta: stats.currentMerged - stats.prevMerged,
      avgReviewHours,
      aiBlocked: stats.aiBlocked,
      activeContributors: stats.activeContributors.size,
      signalRate,
    };
  });

  resultRows.sort((a, b) => b.prsMerged - a.prsMerged);

  return ok(resultRows);
}

export type AiDetectionBreakdown = {
  total: number;
  byReason: {
    largeDiff: number;
    generatedMsg: number;
    newAccount: number;
    suspiciousIp: number;
  };
};

export async function getAiDetectionBreakdown(
  installationId: number,
  range: AnalyticsRange,
): Promise<Result<AiDetectionBreakdown>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Check if AI detection is enabled for this installation
  const { data: settings } = await service
    .from('installation_settings')
    .select('ai_pr_detection')
    .eq('installation_id', installationId)
    .maybeSingle();

  if (!settings?.ai_pr_detection) {
    return err('ai_detection_disabled', 'AI PR detection is not enabled for this installation');
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok({
      total: 0,
      byReason: { largeDiff: 0, generatedMsg: 0, newAccount: 0, suspiciousIp: 0 },
    });
  }

  const now = new Date();
  const bounds = rangeToDateBounds(range, now);

  const { data: rows, error } = await service
    .from('pull_requests')
    .select('ai_flag_reason')
    .in('repo_full_name', repos)
    .eq('ai_flagged', true)
    .gte('github_updated_at', bounds.from.toISOString())
    .lte('github_updated_at', bounds.to.toISOString());

  if (error) {
    return err('query_failed', error.message);
  }

  const byReason = {
    largeDiff: 0,
    generatedMsg: 0,
    newAccount: 0,
    suspiciousIp: 0,
  };

  for (const row of rows ?? []) {
    const reason = (row as { ai_flag_reason: string | null }).ai_flag_reason;
    if (reason === 'large_diff') byReason.largeDiff++;
    else if (reason === 'generated_msg') byReason.generatedMsg++;
    else if (reason === 'new_account') byReason.newAccount++;
    else if (reason === 'suspicious_ip') byReason.suspiciousIp++;
    // Rows with null reason (legacy data before migration) are still counted in total
  }

  const total = (rows ?? []).length;
  return ok({ total, byReason });
}
