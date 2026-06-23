'use server';

import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { requireUser, requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import {
  listMaintainerInstalls,
  listMaintainerRepos,
  type MaintainerInstall,
} from '@/lib/maintainer/detect';
import {
  comparePrRows,
  validateFilters,
  type MaintainerPrRow,
  type QueueFilters,
} from '@/lib/maintainer/queue';
import {
  validateCommunityUrl,
  COMMUNITY_KINDS,
  type CommunityKind,
} from '@/lib/maintainer/community';
import { inngest } from '@/inngest/client';
import { getInstallOctokit } from '@/lib/github/app';
import { cacheGet, cacheSet } from '@/lib/cache';
import { tryGetDb } from '@/lib/db/client';
import { profiles, xpEvents } from '@/lib/db/schema';
import { eq, inArray, sum, desc } from 'drizzle-orm';

import { classifyTriage, type IssueTriageBucket } from '@/lib/maintainer/issue-triage';
import type { MaintainerAnalyticsTrends } from '@/lib/maintainer/analytics';

export type MaintainerIssueRow = {
  id: number;
  repoFullName: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  authorLogin: string | null;
  assigneeLogin: string | null;
  labels: string[];
  commentsCount: number;
  lastEventAt: string | null;
  githubCreatedAt: string | null;
  triage: IssueTriageBucket;
};

export type RepoHealthRow = {
  repoFullName: string;
  repoHealthScore: number;
  updatedAt: string | null;
};

export type StaleIssueRow = {
  id: number;
  title: string;
  repoFullName: string;
  daysStale: number;
  claimed: boolean;
};

export type ContributorRow = {
  githubHandle: string;
  xp: number;
  level: number;
};

export type FlaggedAccountRow = {
  id: number;
  githubHandle: string;
  xp: number;
  level: number;
  reason: string;
  severity: 'medium' | 'high';
  detectedAt: string;
  summary: string;
  count: number;
};

export type InstallationSettingsData = {
  installationId: number;
  minContributorLevel: 0 | 1 | 2 | 3;
  autoAssignMentorChain: boolean;
  aiPrDetection: boolean;
};

const ISSUE_BUCKETS = new Set<IssueTriageBucket>([
  'needs-triage',
  'in-progress',
  'stale',
  'closed',
]);

const PAGE_SIZE = 25;
const MIN_CONTRIBUTOR_LEVELS = new Set([0, 1, 2, 3]);

export async function getMaintainerInstalls(): Promise<Result<MaintainerInstall[]>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const installs = await listMaintainerInstalls(user.id);
  return ok(installs);
}

async function assertMaintainerInstall(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string,
  installationId: number,
): Promise<boolean> {
  const { data: junction } = await service
    .from('github_installation_users')
    .select('installation_id')
    .eq('user_id', userId)
    .eq('installation_id', installationId)
    .maybeSingle();

  return !!junction;
}

async function readMinContributorLevel(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  installationId: number,
): Promise<0 | 1 | 2 | 3> {
  const { data } = await service
    .from('installation_settings')
    .select('min_contributor_level')
    .eq('installation_id', installationId)
    .maybeSingle();

  const level = data?.min_contributor_level;
  return MIN_CONTRIBUTOR_LEVELS.has(level) ? (level as 0 | 1 | 2 | 3) : 0;
}

async function readInstallationSettings(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  installationId: number,
): Promise<Omit<InstallationSettingsData, 'installationId'>> {
  const { data } = await service
    .from('installation_settings')
    .select('min_contributor_level, auto_assign_mentor_chain, ai_pr_detection')
    .eq('installation_id', installationId)
    .maybeSingle();

  const level = data?.min_contributor_level;
  return {
    minContributorLevel: MIN_CONTRIBUTOR_LEVELS.has(level) ? (level as 0 | 1 | 2 | 3) : 0,
    autoAssignMentorChain: data?.auto_assign_mentor_chain ?? false,
    aiPrDetection: data?.ai_pr_detection ?? false,
  };
}

export async function getInstallationSettings(
  installationId: number,
): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, installationId))) {
    return err('not_authorised', 'not your install');
  }

  const settings = await readInstallationSettings(service, installationId);
  return ok({
    installationId,
    ...settings,
  });
}

export async function setMinContributorLevel(opts: {
  installationId: number;
  minContributorLevel: number;
}): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!MIN_CONTRIBUTOR_LEVELS.has(opts.minContributorLevel)) {
    return err('invalid_input', 'minimum contributor level must be L0, L1, L2, or L3');
  }

  if (!(await assertMaintainerInstall(service, user.id, opts.installationId))) {
    return err('not_authorised', 'not your install');
  }

  const minContributorLevel = opts.minContributorLevel as 0 | 1 | 2 | 3;
  const current = await readInstallationSettings(service, opts.installationId);
  const { error } = await service.from('installation_settings').upsert(
    {
      installation_id: opts.installationId,
      min_contributor_level: minContributorLevel,
      auto_assign_mentor_chain: current.autoAssignMentorChain,
      ai_pr_detection: current.aiPrDetection,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id' },
  );
  if (error) return err('persist_failed', error.message);

  return ok({
    installationId: opts.installationId,
    minContributorLevel,
    autoAssignMentorChain: current.autoAssignMentorChain,
    aiPrDetection: current.aiPrDetection,
  });
}

export async function setAutoAssignMentorChain(opts: {
  installationId: number;
  enabled: boolean;
}): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, opts.installationId))) {
    return err('not_authorised', 'not your install');
  }

  const current = await readInstallationSettings(service, opts.installationId);
  const { error } = await service.from('installation_settings').upsert(
    {
      installation_id: opts.installationId,
      min_contributor_level: current.minContributorLevel,
      auto_assign_mentor_chain: opts.enabled,
      ai_pr_detection: current.aiPrDetection,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id' },
  );
  if (error) return err('persist_failed', error.message);

  return ok({
    installationId: opts.installationId,
    minContributorLevel: current.minContributorLevel,
    autoAssignMentorChain: opts.enabled,
    aiPrDetection: current.aiPrDetection,
  });
}

export async function setAiPrDetection(opts: {
  installationId: number;
  enabled: boolean;
}): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', limit: 30, windowSec: 60 },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, opts.installationId))) {
    return err('not_authorised', 'not your install');
  }

  const current = await readInstallationSettings(service, opts.installationId);
  const { error } = await service.from('installation_settings').upsert(
    {
      installation_id: opts.installationId,
      min_contributor_level: current.minContributorLevel,
      auto_assign_mentor_chain: current.autoAssignMentorChain,
      ai_pr_detection: opts.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id' },
  );
  if (error) return err('persist_failed', error.message);

  return ok({
    installationId: opts.installationId,
    minContributorLevel: current.minContributorLevel,
    autoAssignMentorChain: current.autoAssignMentorChain,
    aiPrDetection: opts.enabled,
  });
}

export async function getMaintainerPrQueue(args: {
  installationId: number;
  filters?: Partial<QueueFilters>;
  page?: number;
}): Promise<Result<{ rows: MaintainerPrRow[]; hasMore: boolean }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:queue', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Defense in depth: confirm the requested install actually belongs to the user.
  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  const filters = validateFilters(args.filters ?? {});
  const page = Math.max(0, args.page ?? 0);

  // Apply repo filter on top of scope (intersection).
  const scopedRepos =
    filters.repos.length > 0 ? repos.filter((r) => filters.repos.includes(r)) : repos;
  if (scopedRepos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  const minContributorLevel = await readMinContributorLevel(service, args.installationId);

  let q = service
    .from('pull_requests')
    .select(
      'id, repo_full_name, number, title, url, state, draft, author_login, ' +
        'author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at',
    )
    .in('repo_full_name', scopedRepos);

  if (filters.state.length > 0) q = q.in('state', filters.state);
  if (filters.mentorVerified === 'yes') q = q.eq('mentor_verified', true);
  else if (filters.mentorVerified === 'no') q = q.eq('mentor_verified', false);

  // Pull a generous slice; we re-sort by tier client-side.
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
  const { data: prs } = await q
    .order('github_updated_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE * 4); // overscan for tier resort

  const prRows = (prs ?? []) as unknown as RawPr[];

  // Profile lookups for level + xp + merged count, batched.
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

  const rows: MaintainerPrRow[] = prRows.map((r) => {
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

  // Apply author-level filter after the join (since author level isn't on
  // the pull_requests row).
  let filtered = rows.filter((row) => (row.authorLevel ?? 0) >= minContributorLevel);
  if (filters.authorLevel.length > 0) {
    filtered = filtered.filter((row) => filters.authorLevel.includes(row.authorLevel ?? 0));
  }

  filtered.sort(comparePrRows);

  const page_rows = filtered.slice(0, PAGE_SIZE);
  const hasMore = filtered.length > PAGE_SIZE;
  return ok({ rows: page_rows, hasMore });
}

export async function getMaintainerIssueQueue(args: {
  installationId: number;
  buckets?: IssueTriageBucket[];
  repos?: string[];
  page?: number;
}): Promise<Result<{ rows: MaintainerIssueRow[]; hasMore: boolean }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:issues', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  const scopedRepos =
    args.repos && args.repos.length > 0 ? repos.filter((r) => args.repos!.includes(r)) : repos;
  if (scopedRepos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  // Default: open issues only. Buckets validated against the enum.
  const buckets = (args.buckets ?? ['needs-triage', 'in-progress', 'stale']).filter((b) =>
    ISSUE_BUCKETS.has(b),
  );

  // Pull a generous slice — we classify in app code, can't filter buckets in SQL.
  const page = Math.max(0, args.page ?? 0);
  const states: ('open' | 'closed')[] = buckets.includes('closed') ? ['open', 'closed'] : ['open'];

  type RawIssue = {
    id: number;
    repo_full_name: string;
    github_issue_number: number;
    title: string;
    url: string;
    state: 'open' | 'closed';
    author_login: string | null;
    assignee_login: string | null;
    labels: string[] | null;
    comments_count: number;
    last_event_at: string | null;
    github_created_at: string | null;
  };

  const { data: issuesRaw } = await service
    .from('issues')
    .select(
      'id, repo_full_name, github_issue_number, title, url, state, author_login, ' +
        'assignee_login, labels, comments_count, last_event_at, github_created_at',
    )
    .in('repo_full_name', scopedRepos)
    .in('state', states)
    .order('last_event_at', { ascending: false, nullsFirst: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE * 4);

  const rows: MaintainerIssueRow[] = ((issuesRaw ?? []) as unknown as RawIssue[]).map((r) => {
    const triage = classifyTriage({
      state: r.state,
      assigneeLogin: r.assignee_login,
      labels: r.labels,
      lastEventAt: r.last_event_at ? new Date(r.last_event_at) : null,
      githubCreatedAt: r.github_created_at ? new Date(r.github_created_at) : null,
    });
    return {
      id: r.id,
      repoFullName: r.repo_full_name,
      number: r.github_issue_number,
      title: r.title,
      url: r.url,
      state: r.state,
      authorLogin: r.author_login,
      assigneeLogin: r.assignee_login,
      labels: r.labels ?? [],
      commentsCount: r.comments_count,
      lastEventAt: r.last_event_at,
      githubCreatedAt: r.github_created_at,
      triage,
    };
  });

  const filtered = rows.filter((r) => buckets.includes(r.triage));
  // needs-triage first, then stale, then in-progress, then closed.
  const bucketOrder: Record<IssueTriageBucket, number> = {
    'needs-triage': 0,
    stale: 1,
    'in-progress': 2,
    closed: 3,
  };
  filtered.sort((a, b) => {
    const d = bucketOrder[a.triage] - bucketOrder[b.triage];
    if (d !== 0) return d;
    // Within a bucket: most recent event first; nulls last.
    const at = a.lastEventAt ? Date.parse(a.lastEventAt) : 0;
    const bt = b.lastEventAt ? Date.parse(b.lastEventAt) : 0;
    return bt - at;
  });

  const pageRows = filtered.slice(0, PAGE_SIZE);
  return ok({ rows: pageRows, hasMore: filtered.length > PAGE_SIZE });
}

export async function refreshMaintainerBackfill(
  installationId: number,
): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:backfill', ...RATE_LIMIT_TIERS.HOURLY },
    rateLimitMessage: 'try again in an hour',
  });
  if (!authRes.ok) return authRes;

  await inngest.send({
    name: 'pr-backfill/installation',
    data: { installationId },
  });
  return ok({ ok: true });
}

// ---------------- community links ----------------

export type CommunityLink = {
  id: number;
  installationId: number;
  kind: CommunityKind;
  url: string;
  label: string | null;
  updatedAt: string;
};

export async function getCommunityLinks(installationId: number): Promise<Result<CommunityLink[]>> {
  const authRes = await requireMaintainer({ requireService: true });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data } = await service
    .from('org_communities')
    .select('id, installation_id, kind, url, label, updated_at')
    .eq('installation_id', installationId)
    .order('kind');

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      installationId: r.installation_id,
      kind: r.kind as CommunityKind,
      url: r.url,
      label: r.label,
      updatedAt: r.updated_at,
    })),
  );
}

export async function upsertCommunityLink(input: {
  installationId: number;
  kind: CommunityKind;
  url: string;
  label?: string;
}): Promise<Result<{ id: number }>> {
  const authRes = await requireMaintainer({ requireService: true });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Confirm the install is one the user maintains.
  const { data: junction } = await service
    .from('github_installation_users')
    .select('installation_id')
    .eq('user_id', user.id)
    .eq('installation_id', input.installationId)
    .maybeSingle();
  if (!junction) return err('not_authorised', 'not your install');

  const validated = validateCommunityUrl(input.url, input.kind);
  if (!validated.ok) return err('invalid_url', validated.reason);

  const { data, error } = await service
    .from('org_communities')
    .upsert(
      {
        installation_id: input.installationId,
        kind: input.kind,
        url: validated.url,
        label: input.label ?? null,
        created_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'installation_id,kind' },
    )
    .select('id')
    .single();
  if (error || !data) return err('persist_failed', error?.message ?? 'upsert failed');

  return ok({ id: data.id });
}

export async function deleteCommunityLink(linkId: number): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({ requireService: true });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Find link + verify install belongs to user.
  const { data: link } = await service
    .from('org_communities')
    .select('installation_id')
    .eq('id', linkId)
    .maybeSingle();
  if (!link) return err('not_found', 'link not found');

  const { data: junction } = await service
    .from('github_installation_users')
    .select('installation_id')
    .eq('user_id', user.id)
    .eq('installation_id', link.installation_id)
    .maybeSingle();
  if (!junction) return err('not_authorised', 'not your install');

  await service.from('org_communities').delete().eq('id', linkId);
  return ok({ ok: true });
}

export async function getPrCiStatus(
  installationId: number,
  repoFullName: string,
  prNumber: number,
): Promise<Result<'passing' | 'failing' | 'pending' | null>> {
  const authRes = await requireMaintainer({ requireService: true });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, installationId))) {
    return err('not_authorised', 'not your install');
  }

  const cacheKey = `ci:status:${repoFullName}:${prNumber}`;
  const cached = await cacheGet<'passing' | 'failing' | 'pending' | null>(cacheKey);
  if (cached !== null) {
    return ok(cached);
  }

  // Fallback for local development using mock/demo seed repositories or if App Credentials are not configured
  if (repoFullName.startsWith('demo/') || !process.env.GITHUB_APP_ID) {
    const mockStatuses: ('passing' | 'failing' | 'pending')[] = ['passing', 'failing', 'pending'];
    const status = mockStatuses[prNumber % mockStatuses.length]!;
    await cacheSet(cacheKey, status, 120);
    return ok(status);
  }

  try {
    const octokit = await getInstallOctokit(installationId);
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      return ok(null);
    }

    // Fetch the pull request to get the head SHA.
    const prRes = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    const headSha = prRes.data.head.sha;

    // Fetch check runs for the head SHA.
    const checksRes = await octokit.checks.listForRef({
      owner,
      repo,
      ref: headSha,
    });

    const checkRuns = checksRes.data.check_runs ?? [];
    let status: 'passing' | 'failing' | 'pending' | null = null;

    if (checkRuns.length > 0) {
      const hasPending = checkRuns.some((run) => run.status !== 'completed');
      const hasFailed = checkRuns.some(
        (run) =>
          run.status === 'completed' &&
          ['failure', 'timed_out', 'action_required'].includes(run.conclusion || ''),
      );

      if (hasFailed) {
        status = 'failing';
      } else if (hasPending) {
        status = 'pending';
      } else {
        status = 'passing';
      }
    }

    await cacheSet(cacheKey, status, 120);
    return ok(status);
  } catch (error) {
    // Fall back to no badge
    return ok(null);
  }
}

// (COMMUNITY_KINDS is imported directly from '@/lib/maintainer/community'
// in client / page code — re-exporting it here would violate Next.js's
// 'use server' rule that only async functions may be exported.)
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
  const { user, service } = authRes.data;

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

// ---------------- repo picker (managed flag) ----------------

export type RepoPickerRow = {
  repoFullName: string;
  managed: boolean;
  language: string | null;
  openPrCount: number;
  lastUpdatedAt: string | null;
};

/**
 * Repos for the onboarding picker: the installed repos the caller can manage,
 * each with its managed flag plus best-effort metadata (primary language, open
 * PR count, last activity) derived from data we already store. Repos with no
 * ingested PRs/issues simply show 0 / null — no live GitHub call here.
 */
export async function getRepoPicker(installationId: number): Promise<Result<RepoPickerRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:repo-picker', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Scope to repos the caller actually maintains for this install.
  const scoped = new Set(await listMaintainerRepos(user.id, installationId));
  if (scoped.size === 0) return ok([]);

  const { data: repoRows } = await service
    .from('installation_repositories')
    .select('repo_full_name, managed, added_at')
    .eq('installation_id', installationId);

  const repos = (repoRows ?? [])
    .map((r) => r as { repo_full_name: string; managed: boolean; added_at: string })
    .filter((r) => scoped.has(r.repo_full_name));
  if (repos.length === 0) return ok([]);

  const repoNames = repos.map((r) => r.repo_full_name);

  // Metadata, derived from tables we already keep. Both queries are scoped to
  // the picker's repo set, so they stay small.
  const openPrCount = new Map<string, number>();
  const lastUpdatedAt = new Map<string, string>();
  const { data: prs } = await service
    .from('pull_requests')
    .select('repo_full_name, state, github_updated_at')
    .in('repo_full_name', repoNames);
  for (const row of (prs ?? []) as {
    repo_full_name: string;
    state: string;
    github_updated_at: string;
  }[]) {
    if (row.state === 'open') {
      openPrCount.set(row.repo_full_name, (openPrCount.get(row.repo_full_name) ?? 0) + 1);
    }
    const prev = lastUpdatedAt.get(row.repo_full_name);
    // Compare as parsed instants — these timestamps may carry offsets, so a
    // lexicographic string compare isn't reliable.
    if (!prev || Date.parse(row.github_updated_at) > Date.parse(prev)) {
      lastUpdatedAt.set(row.repo_full_name, row.github_updated_at);
    }
  }

  const language = new Map<string, string>();
  const { data: issueRows } = await service
    .from('issues')
    .select('repo_full_name, repo_language')
    .in('repo_full_name', repoNames)
    .not('repo_language', 'is', null);
  for (const row of (issueRows ?? []) as { repo_full_name: string; repo_language: string }[]) {
    // repo_language is the repo's primary language — same across its issues, so
    // the first non-null wins.
    if (!language.has(row.repo_full_name)) {
      language.set(row.repo_full_name, row.repo_language);
    }
  }

  return ok(
    repos.map((r) => ({
      repoFullName: r.repo_full_name,
      managed: r.managed,
      language: language.get(r.repo_full_name) ?? null,
      openPrCount: openPrCount.get(r.repo_full_name) ?? 0,
      lastUpdatedAt: lastUpdatedAt.get(r.repo_full_name) ?? r.added_at,
    })),
  );
}

/**
 * Toggle whether MergeShip manages a single installed repo. Guarded so a
 * maintainer can only touch repos within their own install scope.
 */
export async function setRepoManaged(input: {
  installationId: number;
  repoFullName: string;
  managed: boolean;
}): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:repo-managed', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const scoped = await listMaintainerRepos(user.id, input.installationId);
  if (!scoped.includes(input.repoFullName)) {
    return err('not_authorised', 'not your repo');
  }

  const { data, error } = await service
    .from('installation_repositories')
    .update({ managed: input.managed })
    .eq('installation_id', input.installationId)
    .eq('repo_full_name', input.repoFullName)
    .select('repo_full_name');
  if (error) return err('persist_failed', error.message);
  // Zero rows updated → the repo isn't installed under this install (e.g. stale
  // scope data). Surface it rather than reporting a phantom success.
  if (!data || data.length === 0) return err('not_found', 'repo not found for install');

  return ok({ ok: true });
}

export async function getFlaggedAccounts(args?: {
  installationId?: number;
}): Promise<Result<FlaggedAccountRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  let installationId = args?.installationId;

  if (!installationId) {
    const installs = await listMaintainerInstalls(user.id);
    const installationIds = installs.map((i) => i.installationId);
    if (installationIds.length === 0) {
      return ok([]);
    }
    installationId = installationIds[0];
  }

  if (!installationId) {
    return ok([]);
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const { data: flags, error } = await service
    .from('flagged_accounts')
    .select('id, user_id, reason, severity, evidence, detected_at')
    .eq('status', 'open')
    .order('detected_at', { ascending: false });

  if (error) {
    return err('query_failed', error.message);
  }

  if (!flags || flags.length === 0) {
    return ok([]);
  }

  const userIds = Array.from(new Set(flags.map((flag) => flag.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return ok([]);
  }

  const { data: prUsers, error: prError } = await service
    .from('pull_requests')
    .select('author_user_id')
    .in('author_user_id', userIds)
    .in('repo_full_name', repos);

  if (prError) {
    return err('query_failed', prError.message);
  }

  const { data: recUsers, error: recError } = await service
    .from('recommendations')
    .select('user_id, issues!inner(repo_full_name)')
    .in('user_id', userIds)
    .in('issues.repo_full_name', repos);

  if (recError) {
    return err('query_failed', recError.message);
  }

  const activeUserIds = new Set<string>();
  for (const pr of prUsers ?? []) {
    if (pr.author_user_id) {
      activeUserIds.add(pr.author_user_id);
    }
  }
  for (const rec of recUsers ?? []) {
    if (rec.user_id) {
      activeUserIds.add(rec.user_id);
    }
  }

  const allowedFlags = flags.filter((flag) => {
    if (!flag.user_id || !activeUserIds.has(flag.user_id)) {
      return false;
    }
    const evidence = flag.evidence as any;
    const items = Array.isArray(evidence?.items) ? evidence.items : [];
    return items.some((item: any) => {
      const r = item.repo || item.repoFullName;
      return typeof r === 'string' && repos.includes(r);
    });
  });

  const limitedFlags = allowedFlags.slice(0, 10);

  const allowedUserIds = Array.from(
    new Set(limitedFlags.map((flag) => flag.user_id).filter(Boolean)),
  );
  const { data: profiles, error: profilesError } =
    allowedUserIds.length > 0
      ? await service
          .from('profiles')
          .select('id, github_handle, xp, level')
          .in('id', allowedUserIds)
      : { data: [], error: null };

  if (profilesError) {
    return err('query_failed', profilesError.message);
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        githubHandle: profile.github_handle ?? 'unknown',
        xp: profile.xp ?? 0,
        level: profile.level ?? 0,
      },
    ]),
  );

  return ok(
    limitedFlags.map((flag) => {
      const profile = profilesById.get(flag.user_id ?? '');

      const evidence = flag.evidence as any;
      const items = Array.isArray(evidence?.items) ? evidence.items : [];
      const filteredItems = items.filter((item: any) => {
        const r = item.repo || item.repoFullName;
        return typeof r === 'string' && repos.includes(r);
      });
      const count = filteredItems.length;
      let summary = 'Suspicious activity pattern detected.';
      if (flag.reason === 'daily_xp_event_spike') {
        const totalXp = filteredItems.reduce(
          (sum: number, item: any) => sum + (item.xpDelta ?? 0),
          0,
        );
        summary = `${count} XP event${count === 1 ? '' : 's'} in one UTC day (${totalXp} XP total).`;
      } else if (flag.reason === 'rapid_merge_spike') {
        summary = `${count} merged PR${count === 1 ? '' : 's'} landed inside one hour.`;
      } else if (flag.reason === 'reviewer_approval_concentration') {
        summary = `${count} approval${count === 1 ? '' : 's'} from the same reviewer in one week.`;
      }

      return {
        id: flag.id,
        githubHandle: profile?.githubHandle ?? 'unknown',
        xp: profile?.xp ?? 0,
        level: profile?.level ?? 0,
        reason: flag.reason,
        severity: flag.severity === 'high' ? 'high' : 'medium',
        detectedAt: flag.detected_at,
        summary: summary,
        count: count,
      };
    }),
  );
}

export async function resolveFlaggedAccount(
  flagId: number,
  status: 'reviewed' | 'dismissed',
  installationId: number,
): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', limit: 30, windowSec: 60 },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: flag, error: findError } = await service
    .from('flagged_accounts')
    .select('id, evidence, user_id')
    .eq('id', flagId)
    .single();

  if (findError || !flag) {
    return err('not_found', 'Flag not found');
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  const evidence = flag.evidence as any;
  const items = Array.isArray(evidence?.items) ? evidence.items : [];
  const isAuthorized = items.some((item: any) => {
    const r = item.repo || item.repoFullName;
    return typeof r === 'string' && repos.includes(r);
  });

  if (!isAuthorized) {
    return err('not_authorised', 'not authorized to resolve this flag');
  }

  const { error: updateError } = await service
    .from('flagged_accounts')
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', flagId);

  if (updateError) {
    return err('persist_failed', updateError.message);
  }

  return ok({ ok: true });
}
