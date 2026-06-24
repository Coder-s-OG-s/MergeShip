'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { rateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { isUserMaintainer, listMaintainerRepos } from '@/lib/maintainer/detect';
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
import { type MaintainerIssueRow, MIN_CONTRIBUTOR_LEVELS } from './types';

const PAGE_SIZE = 25;
const ISSUE_BUCKETS = new Set<IssueTriageBucket>([
  'needs-triage',
  'in-progress',
  'stale',
  'closed',
]);

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
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const limited = await rateLimit({
    namespace: 'maint:queue',
    key: user.id,
    ...RATE_LIMIT_TIERS.GENEROUS,
  });
  if (!limited.ok) return err('rate_limited', 'slow down', true);

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  const filters = validateFilters(args.filters ?? {});
  const page = Math.max(0, args.page ?? 0);

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
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE * 4);

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
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const limited = await rateLimit({
    namespace: 'maint:issues',
    key: user.id,
    ...RATE_LIMIT_TIERS.GENEROUS,
  });
  if (!limited.ok) return err('rate_limited', 'slow down', true);

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  const scopedRepos =
    args.repos && args.repos.length > 0 ? repos.filter((r) => args.repos!.includes(r)) : repos;
  if (scopedRepos.length === 0) {
    return ok({ rows: [], hasMore: false });
  }

  const buckets = (args.buckets ?? ['needs-triage', 'in-progress', 'stale']).filter((b) =>
    ISSUE_BUCKETS.has(b),
  );

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
  const bucketOrder: Record<IssueTriageBucket, number> = {
    'needs-triage': 0,
    stale: 1,
    'in-progress': 2,
    closed: 3,
  };
  filtered.sort((a, b) => {
    const d = bucketOrder[a.triage] - bucketOrder[b.triage];
    if (d !== 0) return d;
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
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const limited = await rateLimit({
    namespace: 'maint:backfill',
    key: user.id,
    ...RATE_LIMIT_TIERS.HOURLY,
  });
  if (!limited.ok) return err('rate_limited', 'try again in an hour', true);

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
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
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

  const cacheKey = `ci:status:${repoFullName}:${prNumber}`;
  const cached = await cacheGet<'passing' | 'failing' | 'pending' | null>(cacheKey);
  if (cached !== null) {
    return ok(cached);
  }

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

    const prRes = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    const headSha = prRes.data.head.sha;

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
    return ok(null);
  }
}
