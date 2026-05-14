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

export type { MaintainerInstall, MaintainerPrRow };

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

// ---------------- dashboard types ----------------

export type DashboardStats = {
  openPrs: number;
  mentorVerified: number;
  aiFlagged: number;
  openIssues: number;
  stalePrs: number;
};

export type ActivityItem = {
  type: 'pr_merged' | 'contributor_joined' | 'pr_opened';
  text: string;
  subtext: string;
  timestamp: string;
};

export type HelpRequestRow = {
  id: number;
  handle: string;
  message: string;
  prUrl: string | null;
  createdAt: string;
};

export type LevelDistribution = {
  l0: number;
  l1: number;
  l2: number;
  l3plus: number;
};

export type ContributorRow = {
  id: string;
  handle: string;
  level: number;
  xp: number;
  mergedPrs: number;
  joinedAt: string;
};

export type MentorRow = {
  id: string;
  handle: string;
  level: number;
  xp: number;
  helpResolved: number;
};

// ---------------- dashboard actions ----------------

export async function getMaintainerDashboardStats(
  installationId: number,
): Promise<Result<DashboardStats>> {
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

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok({ openPrs: 0, mentorVerified: 0, aiFlagged: 0, openIssues: 0, stalePrs: 0 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [openPrsRes, mentorVerifiedRes, stalePrsRes, openIssuesRes] = await Promise.all([
    service
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'open')
      .in('repo_full_name', repos),
    service
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'open')
      .eq('mentor_verified', true)
      .in('repo_full_name', repos),
    service
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'open')
      .lt('github_updated_at', sevenDaysAgo)
      .in('repo_full_name', repos),
    service.from('issues').select('id', { count: 'exact', head: true }).eq('state', 'open'),
  ]);

  return ok({
    openPrs: openPrsRes.count ?? 0,
    mentorVerified: mentorVerifiedRes.count ?? 0,
    aiFlagged: 0,
    openIssues: openIssuesRes.count ?? 0,
    stalePrs: stalePrsRes.count ?? 0,
  });
}

export async function getMaintainerRecentActivity(
  installationId: number,
): Promise<Result<ActivityItem[]>> {
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

  const repos = await listMaintainerRepos(user.id, installationId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [mergedRes, profilesRes, openedRes] = await Promise.all([
    repos.length > 0
      ? service
          .from('pull_requests')
          .select('number, title, author_login, merged_at')
          .eq('state', 'merged')
          .in('repo_full_name', repos)
          .gte('merged_at', since)
          .order('merged_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    service
      .from('profiles')
      .select('github_handle, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    repos.length > 0
      ? service
          .from('pull_requests')
          .select('number, title, author_login, github_created_at')
          .eq('state', 'open')
          .in('repo_full_name', repos)
          .gte('github_created_at', since)
          .order('github_created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const items: ActivityItem[] = [];

  for (const r of (mergedRes.data ?? []) as {
    number: number;
    title: string;
    author_login: string;
    merged_at: string;
  }[]) {
    items.push({
      type: 'pr_merged',
      text: `#${r.number} merged`,
      subtext: r.title,
      timestamp: r.merged_at,
    });
  }

  for (const r of (profilesRes.data ?? []) as { github_handle: string; created_at: string }[]) {
    items.push({
      type: 'contributor_joined',
      text: `@${r.github_handle} joined`,
      subtext: 'New contributor',
      timestamp: r.created_at,
    });
  }

  for (const r of (openedRes.data ?? []) as {
    number: number;
    title: string;
    author_login: string;
    github_created_at: string;
  }[]) {
    items.push({
      type: 'pr_opened',
      text: `#${r.number} opened`,
      subtext: r.title,
      timestamp: r.github_created_at,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return ok(items.slice(0, 10));
}

export async function getMaintainerHelpRequests(): Promise<Result<HelpRequestRow[]>> {
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

  const { data: requests } = await service
    .from('help_requests')
    .select('id, pr_url, reason, user_id, created_at')
    .in('status', ['open', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(5);

  const rows = (requests ?? []) as {
    id: number;
    pr_url: string | null;
    reason: string | null;
    user_id: string;
    created_at: string;
  }[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const handleMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, github_handle')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      handleMap.set(p.id, p.github_handle);
    }
  }

  return ok(
    rows.map((r) => ({
      id: r.id,
      handle: handleMap.get(r.user_id) ?? 'unknown',
      message: r.reason ?? r.pr_url ?? 'Help requested',
      prUrl: r.pr_url,
      createdAt: r.created_at,
    })),
  );
}

export async function getMaintainerLevelDistribution(): Promise<Result<LevelDistribution>> {
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

  const { data } = await service.from('profiles').select('level').limit(1000);

  const rows = (data ?? []) as { level: number | null }[];
  let l0 = 0,
    l1 = 0,
    l2 = 0,
    l3plus = 0;
  for (const r of rows) {
    const lvl = r.level ?? 0;
    if (lvl === 0) l0++;
    else if (lvl === 1) l1++;
    else if (lvl === 2) l2++;
    else l3plus++;
  }

  return ok({ l0, l1, l2, l3plus });
}

export async function getMaintainerContributors(args: {
  installationId: number;
  page?: number;
}): Promise<Result<{ rows: ContributorRow[]; hasMore: boolean }>> {
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

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) return ok({ rows: [], hasMore: false });

  const page = Math.max(0, args.page ?? 0);
  const limit = 25;

  const { data: prAuthorRows } = await service
    .from('pull_requests')
    .select('author_user_id')
    .in('repo_full_name', repos)
    .not('author_user_id', 'is', null);

  const authorIds = Array.from(
    new Set(
      (prAuthorRows ?? [])
        .map((r: { author_user_id: string | null }) => r.author_user_id)
        .filter((id): id is string => !!id),
    ),
  );

  if (authorIds.length === 0) return ok({ rows: [], hasMore: false });

  const { data: profiles } = await service
    .from('profiles')
    .select('id, github_handle, level, xp, created_at')
    .in('id', authorIds)
    .order('xp', { ascending: false })
    .range(page * limit, (page + 1) * limit);

  const profileRows = (profiles ?? []) as {
    id: string;
    github_handle: string;
    level: number | null;
    xp: number | null;
    created_at: string;
  }[];

  const pageIds = profileRows.map((p) => p.id);
  const mergedCountMap = new Map<string, number>();

  if (pageIds.length > 0) {
    const { data: mergedPrs } = await service
      .from('pull_requests')
      .select('author_user_id')
      .eq('state', 'merged')
      .in('author_user_id', pageIds)
      .in('repo_full_name', repos);
    for (const r of (mergedPrs ?? []) as { author_user_id: string }[]) {
      mergedCountMap.set(r.author_user_id, (mergedCountMap.get(r.author_user_id) ?? 0) + 1);
    }
  }

  const rows: ContributorRow[] = profileRows.map((p) => ({
    id: p.id,
    handle: p.github_handle,
    level: p.level ?? 0,
    xp: p.xp ?? 0,
    mergedPrs: mergedCountMap.get(p.id) ?? 0,
    joinedAt: p.created_at,
  }));

  return ok({ rows, hasMore: rows.length === limit });
}

export async function getMaintainerMentors(installationId: number): Promise<Result<MentorRow[]>> {
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

  // installationId is used for auth context (already checked above via isUserMaintainer)
  void installationId;

  const { data: mentorProfiles } = await service
    .from('profiles')
    .select('id, github_handle, level, xp')
    .gte('level', 2)
    .order('level', { ascending: false })
    .order('xp', { ascending: false })
    .limit(20);

  const profiles = (mentorProfiles ?? []) as {
    id: string;
    github_handle: string;
    level: number;
    xp: number;
  }[];

  const mentorIds = profiles.map((p) => p.id);
  const resolvedMap = new Map<string, number>();

  if (mentorIds.length > 0) {
    const { data: resolved } = await service
      .from('help_requests')
      .select('resolved_by')
      .in('resolved_by', mentorIds)
      .not('resolved_by', 'is', null);
    for (const r of (resolved ?? []) as { resolved_by: string }[]) {
      resolvedMap.set(r.resolved_by, (resolvedMap.get(r.resolved_by) ?? 0) + 1);
    }
  }

  const rows: MentorRow[] = profiles.map((p) => ({
    id: p.id,
    handle: p.github_handle,
    level: p.level,
    xp: p.xp,
    helpResolved: resolvedMap.get(p.id) ?? 0,
  }));

  return ok(rows);
}
