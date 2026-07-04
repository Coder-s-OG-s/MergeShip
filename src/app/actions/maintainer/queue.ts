'use server';

import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import {
  comparePrRows,
  validateFilters,
  type MaintainerPrRow,
  type QueueFilters,
} from '@/lib/maintainer/queue';
import { classifyTriage, type IssueTriageBucket } from '@/lib/maintainer/issue-triage';
import { inngest } from '@/inngest/client';
import { getInstallOctokit } from '@/lib/github/app';
import { cacheGet, cacheSet } from '@/lib/cache';
import { type MaintainerIssueRow, type TimelineEvent } from './types';
import { MIN_CONTRIBUTOR_LEVELS } from './constants';

const PAGE_SIZE = 25;
const ISSUE_BUCKETS = new Set<IssueTriageBucket>([
  'needs-triage',
  'in-progress',
  'stale',
  'closed',
]);

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
        'author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at, ai_flagged',
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
    ai_flagged: boolean;
  };
  const { data: prs } = await q
    .order('github_updated_at', { ascending: false })
    .range(
      Math.floor(page / 4) * PAGE_SIZE * 4,
      Math.floor(page / 4) * PAGE_SIZE * 4 + PAGE_SIZE * 4 - 1,
    ); // fetch non-overlapping blocks for tier resort

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
      aiFlagged: r.ai_flagged,
    };
  });

  // Apply author-level filter after the join (since author level isn't on
  // the pull_requests row).
  let filtered = rows.filter((row) => (row.authorLevel ?? 0) >= minContributorLevel);
  if (filters.authorLevel.length > 0) {
    filtered = filtered.filter((row) => filters.authorLevel.includes(row.authorLevel ?? 0));
  }
  if (filters.aiFlagged === 'yes') {
    filtered = filtered.filter((row) => row.aiFlagged);
  } else if (filters.aiFlagged === 'no') {
    filtered = filtered.filter((row) => !row.aiFlagged);
  }

  filtered.sort(comparePrRows);

  const startIdx = (page % 4) * PAGE_SIZE;
  const page_rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const hasMore = startIdx + PAGE_SIZE < filtered.length || prRows.length === PAGE_SIZE * 4;
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
    .range(
      Math.floor(page / 4) * PAGE_SIZE * 4,
      Math.floor(page / 4) * PAGE_SIZE * 4 + PAGE_SIZE * 4 - 1,
    );

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

  const startIdx = (page % 4) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const hasMore =
    startIdx + PAGE_SIZE < filtered.length || (issuesRaw?.length ?? 0) === PAGE_SIZE * 4;
  return ok({ rows: pageRows, hasMore });
}

export async function refreshMaintainerBackfill(
  installationId: number,
): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    requireService: true,
    rateLimit: { namespace: 'maint:backfill', ...RATE_LIMIT_TIERS.HOURLY },
    rateLimitMessage: 'try again in an hour',
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, installationId))) {
    return err('not_authorised', 'not your install');
  }

  await inngest.send({
    name: 'pr-backfill/installation',
    data: { installationId },
  });
  return ok({ ok: true });
}

export async function getPrCiStatus(
  installationId: number,
  repoFullName: string,
  prNumber: number,
): Promise<Result<'passing' | 'failing' | 'pending' | null>> {
  const authRes = await requireMaintainer({
    requireService: true,
    rateLimit: { namespace: 'maint:pr-ci-status', ...RATE_LIMIT_TIERS.GENEROUS },
  });
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

export async function closePullRequest(prId: number): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:close-pr', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Retrieve the PR from the DB using prId
  const { data: pr } = await service
    .from('pull_requests')
    .select('repo_full_name, number')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) {
    return err('not_found', 'PR not found');
  }

  // Find the installation ID for the repo
  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }
  const installationId = repoRow.installation_id;

  // Verify the maintainer has access to this repo under the installation
  const scoped = await listMaintainerRepos(user.id, installationId);
  if (!scoped.includes(pr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  // Call GitHub API to close the PR
  try {
    const octokit = await getInstallOctokit(installationId);
    const [owner, repo] = pr.repo_full_name.split('/');
    if (!owner || !repo) {
      return err('invalid_input', 'Invalid repository format');
    }

    await octokit.pulls.update({
      owner,
      repo,
      pull_number: pr.number,
      state: 'closed',
    });
  } catch (error: any) {
    return err('github_error', error.message || 'Failed to close PR via GitHub API');
  }

  // Update PR state in DB
  const { error: updateErr } = await service
    .from('pull_requests')
    .update({ state: 'closed' })
    .eq('id', prId);

  if (updateErr) {
    return err('persist_failed', updateErr.message);
  }

  return ok({ ok: true });
}

// Fetch a single PR by its ID, used by the PR detail page
export async function getMaintainerPrById(args: {
  installationId: number;
  prId: number;
}): Promise<Result<MaintainerPrRow | null>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:pr:detail', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Verify the maintainer has access to the installation
  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) return ok(null);

  // Fetch the PR row
  const { data: pr } = await service
    .from('pull_requests')
    .select(
      'id, repo_full_name, number, title, url, state, draft, author_login, author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at, ai_flagged, body_excerpt, mentor_review_at',
    )
    .eq('id', args.prId)
    .maybeSingle();

  if (!pr) return ok(null);

  // Guard: ensure this PR belongs to a repo the maintainer actually controls.
  // Without this check a maintainer on org A could read PRs from org B by
  // supplying a foreign prId with their own installationId.
  if (!repos.includes(pr.repo_full_name)) return ok(null);

  // Load profiles for author and mentor if present
  const ids: string[] = [];
  if (pr.author_user_id) ids.push(pr.author_user_id);
  if (pr.mentor_reviewer_id) ids.push(pr.mentor_reviewer_id);

  const profilesById = new Map<
    string,
    { handle: string; level: number; xp: number; mergedPrs: number }
  >();
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

  const author = pr.author_user_id ? (profilesById.get(pr.author_user_id) ?? null) : null;
  const mentor = pr.mentor_reviewer_id ? (profilesById.get(pr.mentor_reviewer_id) ?? null) : null;

  const row: MaintainerPrRow = {
    id: pr.id,
    repoFullName: pr.repo_full_name,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state as 'open' | 'closed' | 'merged',
    draft: pr.draft,
    authorLogin: pr.author_login,
    authorUserId: pr.author_user_id,
    authorLevel: author?.level ?? null,
    authorXp: author?.xp ?? null,
    authorMergedPrs: author?.mergedPrs ?? null,
    mentorVerified: pr.mentor_verified,
    mentorReviewerHandle: mentor?.handle ?? null,
    mentorReviewerLevel: mentor?.level ?? null,
    githubUpdatedAt: pr.github_updated_at,
    aiFlagged: pr.ai_flagged,
    bodyExcerpt: pr.body_excerpt,
    mentorReviewAt: pr.mentor_review_at,
  };
  return ok(row);
}

export async function requestChanges(prId: number, comment: string): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:request-changes', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: pr } = await service
    .from('pull_requests')
    .select('repo_full_name, number')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return err('not_found', 'PR not found');

  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }
  const installationId = repoRow.installation_id;

  const scoped = await listMaintainerRepos(user.id, installationId);
  if (!scoped.includes(pr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  if (comment.trim().length === 0) {
    return err('invalid_input', 'Comment is required');
  }

  try {
    const octokit = await getInstallOctokit(installationId);
    const [owner, repo] = pr.repo_full_name.split('/');
    if (!owner || !repo) return err('invalid_input', 'Invalid repository format');
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      event: 'REQUEST_CHANGES',
      body: comment,
    });
  } catch (error: any) {
    return err('github_error', error.message || 'Failed to request changes via GitHub API');
  }

  return ok({ ok: true });
}

export async function mergePullRequest(prId: number): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:merge-pr', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: pr } = await service
    .from('pull_requests')
    .select('repo_full_name, number, state')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return err('not_found', 'PR not found');

  if (pr.state !== 'open') return err('invalid_input', 'PR is not open');

  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }
  const installationId = repoRow.installation_id;

  const scoped = await listMaintainerRepos(user.id, installationId);
  if (!scoped.includes(pr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  try {
    const octokit = await getInstallOctokit(installationId);
    const [owner, repo] = pr.repo_full_name.split('/');
    if (!owner || !repo) return err('invalid_input', 'Invalid repository format');
    await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pr.number,
      merge_method: 'squash',
    });
  } catch (error: any) {
    return err('github_error', error.message || 'Failed to merge PR via GitHub API');
  }

  await service.from('pull_requests').update({ state: 'merged' }).eq('id', prId);

  return ok({ ok: true });
}

export async function getPrActivityTimeline(prId: number): Promise<Result<TimelineEvent[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:timeline', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Retrieve the PR from the DB using prId
  const { data: pr } = await service
    .from('pull_requests')
    .select('repo_full_name, number, author_login')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) {
    return err('not_found', 'PR not found');
  }

  // Find the installation ID for the repo
  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }
  const installationId = repoRow.installation_id;

  // Verify the maintainer has access to this repo under the installation
  const scoped = await listMaintainerRepos(user.id, installationId);
  if (!scoped.includes(pr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  const [owner, repo] = pr.repo_full_name.split('/');
  if (!owner || !repo) {
    return err('invalid_input', 'Invalid repository format');
  }

  // Fallback for local development using mock/demo repositories or if GITHUB_APP_ID is missing
  if (pr.repo_full_name.startsWith('demo/') || !process.env.GITHUB_APP_ID) {
    const mockEvents: TimelineEvent[] = [
      {
        id: 'mock-opened',
        type: 'opened',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        actor: {
          login: pr.author_login || 'contributor',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
        },
        details: {},
      },
      {
        id: 'mock-commit-1',
        type: 'commit',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        actor: {
          login: pr.author_login || 'contributor',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
        },
        details: {
          message: 'feat: initial commit for requested feature',
          sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
        },
      },
      {
        id: 'mock-comment-1',
        type: 'comment',
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        actor: {
          login: 'mentor-guy',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9920?v=4',
        },
        details: {
          body: 'Thanks for the contribution! Could you clean up the code formatting and check the failing test cases?',
        },
      },
      {
        id: 'mock-review-1',
        type: 'review',
        timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        actor: {
          login: 'mentor-guy',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9920?v=4',
        },
        details: {
          state: 'changes_requested',
          body: 'Please make the requested modifications to proceed.',
        },
      },
    ];
    return ok(mockEvents);
  }

  try {
    const octokit = await getInstallOctokit(installationId);

    // Fetch live data in parallel to reduce latency
    const [prRes, commentsRes, reviewsRes, commitsRes] = await Promise.all([
      octokit.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
      }),
      octokit.issues.listComments({
        owner,
        repo,
        issue_number: pr.number,
      }),
      octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pr.number,
      }),
      octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: pr.number,
      }),
    ]);

    const prData = prRes.data;
    const commentsData = commentsRes.data || [];
    const reviewsData = reviewsRes.data || [];
    const commitsData = commitsRes.data || [];

    // 1. Process PR Opened Event
    const events: TimelineEvent[] = [
      {
        id: 'opened',
        type: 'opened',
        timestamp: prData.created_at,
        actor: {
          login: prData.user?.login ?? 'unknown',
          avatarUrl: prData.user?.avatar_url ?? null,
        },
        details: {},
      },
    ];

    // 2. Process Comments
    for (const c of commentsData) {
      events.push({
        id: c.id.toString(),
        type: 'comment',
        timestamp: c.created_at,
        actor: {
          login: c.user?.login ?? 'unknown',
          avatarUrl: c.user?.avatar_url ?? null,
        },
        details: {
          body: c.body ?? '',
        },
      });
    }

    // 3. Process Reviews
    for (const r of reviewsData) {
      let state: TimelineEvent['details']['state'] = 'commented';
      if (r.state === 'APPROVED') {
        state = 'approved';
      } else if (r.state === 'CHANGES_REQUESTED') {
        state = 'changes_requested';
      } else if (r.state === 'DISMISSED') {
        state = 'dismissed';
      }

      if (r.submitted_at) {
        events.push({
          id: r.id.toString(),
          type: 'review',
          timestamp: r.submitted_at,
          actor: {
            login: r.user?.login ?? 'unknown',
            avatarUrl: r.user?.avatar_url ?? null,
          },
          details: {
            state,
            body: r.body ?? '',
          },
        });
      }
    }

    // 4. Process Commits
    for (const c of commitsData) {
      const timestamp = c.commit.committer?.date ?? c.commit.author?.date ?? prData.created_at;
      events.push({
        id: c.sha,
        type: 'commit',
        timestamp,
        actor: {
          login: c.author?.login ?? c.commit.author?.name ?? 'unknown',
          avatarUrl: c.author?.avatar_url ?? null,
        },
        details: {
          message: c.commit.message,
          sha: c.sha,
        },
      });
    }

    // Sort chronologically (ascending)
    events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    return ok(events);
  } catch (error: any) {
    return err('github_error', error.message || 'Failed to fetch timeline data from GitHub API');
  }
}

export async function getPrDetails(prId: number): Promise<Result<MaintainerPrRow>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:pr-details', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Retrieve the PR from the DB using prId
  const { data: rawPr, error: rawPrErr } = await service
    .from('pull_requests')
    .select(
      'id, repo_full_name, number, title, url, state, draft, author_login, author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at, ai_flagged',
    )
    .eq('id', prId)
    .maybeSingle();

  if (rawPrErr) return err('db_error', rawPrErr.message);
  if (!rawPr) {
    return err('not_found', 'PR not found');
  }

  // Find the installation ID for the repo
  const { data: repoRow, error: repoErr } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', rawPr.repo_full_name)
    .maybeSingle();

  if (repoErr) return err('db_error', repoErr.message);
  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }
  const installationId = repoRow.installation_id;

  // Verify the maintainer has access to this repo under the installation
  const scoped = await listMaintainerRepos(user.id, installationId);
  if (!scoped.includes(rawPr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  // Fetch profile lookup for author & mentor
  let authorLevel: number | null = null;
  let authorXp: number | null = null;
  let authorMergedPrs: number | null = null;

  if (rawPr.author_user_id) {
    const { data: authorProfile, error: authorProfileErr } = await service
      .from('profiles')
      .select('level, xp')
      .eq('id', rawPr.author_user_id)
      .maybeSingle();
    if (authorProfile && !authorProfileErr) {
      authorLevel = authorProfile.level;
      authorXp = authorProfile.xp;
    }
    const { data: mergedEvents } = await service
      .from('xp_events')
      .select('id')
      .eq('user_id', rawPr.author_user_id)
      .eq('source', 'recommended_merge');
    authorMergedPrs = mergedEvents?.length ?? 0;
  }

  let mentorReviewerHandle: string | null = null;
  let mentorReviewerLevel: number | null = null;

  if (rawPr.mentor_reviewer_id) {
    const { data: mentorProfile, error: mentorProfileErr } = await service
      .from('profiles')
      .select('github_handle, level')
      .eq('id', rawPr.mentor_reviewer_id)
      .maybeSingle();
    if (mentorProfile && !mentorProfileErr) {
      mentorReviewerHandle = mentorProfile.github_handle;
      mentorReviewerLevel = mentorProfile.level;
    }
  }

  const row: MaintainerPrRow = {
    id: rawPr.id,
    repoFullName: rawPr.repo_full_name,
    number: rawPr.number,
    title: rawPr.title,
    url: rawPr.url,
    state: rawPr.state as 'open' | 'closed' | 'merged',
    draft: rawPr.draft,
    authorLogin: rawPr.author_login,
    authorUserId: rawPr.author_user_id,
    authorLevel,
    authorXp,
    authorMergedPrs,
    mentorVerified: rawPr.mentor_verified,
    mentorReviewerHandle,
    mentorReviewerLevel,
    githubUpdatedAt: rawPr.github_updated_at,
    aiFlagged: rawPr.ai_flagged,
    installationId,
  };

  return ok(row);
}
