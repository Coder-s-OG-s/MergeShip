'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { rateLimit } from '@/lib/rate-limit';
import {
  isUserMaintainer,
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

import { classifyTriage, type IssueTriageBucket } from '@/lib/maintainer/issue-triage';

export type { MaintainerInstall, MaintainerPrRow };

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

const ISSUE_BUCKETS = new Set<IssueTriageBucket>([
  'needs-triage',
  'in-progress',
  'stale',
  'closed',
]);

const PAGE_SIZE = 25;

export async function getMaintainerInstalls(): Promise<Result<MaintainerInstall[]>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const installs = await listMaintainerInstalls(user.id);
  return ok(installs);
}

export async function getMaintainerPrQueue(args: {
  installationId: number;
  filters?: Partial<QueueFilters>;
  page?: number;
}): Promise<Result<{ rows: MaintainerPrRow[]; hasMore: boolean }>> {
  const sb = getServerSupabase();
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
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return err('rate_limited', 'slow down', true);

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

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
  let filtered = rows;
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
  const sb = getServerSupabase();
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
    limit: 60,
    windowSec: 60,
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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const limited = await rateLimit({
    namespace: 'maint:backfill',
    key: user.id,
    limit: 5,
    windowSec: 60 * 60,
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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  if (!(await isUserMaintainer(user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

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

// (COMMUNITY_KINDS is imported directly from '@/lib/maintainer/community'
// in client / page code — re-exporting it here would violate Next.js's
// 'use server' rule that only async functions may be exported.)
export async function getRepoHealthOverview(): Promise<Result<RepoHealthRow[]>> {
  const service = getServiceSupabase();

  if (!service) {
    return err('not_configured', 'service role missing');
  }

  const { data: repos, error } = await service
    .from('tracked_repositories')
    .select('full_name, repo_health_score, updated_at')
    .order('repo_health_score', { ascending: false });

  if (error) {
    return err('query_failed', error.message);
  }

  return ok(
    (repos ?? []).map((repo) => ({
      repoFullName: repo.full_name,
      repoHealthScore: repo.repo_health_score ?? 0,
      updatedAt: repo.updated_at,
    })),
  );
}

export async function getStaleIssues(): Promise<Result<StaleIssueRow[]>> {
  const service = getServiceSupabase();

  if (!service) {
    return err('not_configured', 'service role missing');
  }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: issues, error } = await service
    .from('issues')
    .select('id, title, repo_full_name, github_created_at, assignee_login')
    .eq('state', 'open')
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

export async function getTopContributors(): Promise<Result<ContributorRow[]>> {
  const service = getServiceSupabase();

  if (!service) {
    return err('not_configured', 'service role missing');
  }

  const { data: contributors, error } = await service
    .from('profiles')
    .select('github_handle, xp, level')
    .order('xp', { ascending: false })
    .limit(5);

  if (error) {
    return err('query_failed', error.message);
  }

  return ok(
    (contributors ?? []).map((c) => ({
      githubHandle: c.github_handle ?? 'unknown',
      xp: c.xp ?? 0,
      level: c.level ?? 0,
    })),
  );
}
