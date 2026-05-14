import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache';
import { getInstallationToken } from '@/lib/github/app';
import { PRList } from './pr-list';
import type { GitHubPR } from '@/app/actions/github-sync';

export const dynamic = 'force-dynamic';

type EnrichedPR = GitHubPR & {
  mentor_status?: 'pending' | 'approved' | null;
  reviewed_by?: string | null;
  mentor_level?: string | null;
  close_reason?: string | null;
  xp_earned?: number | null;
};

type PRsCache = {
  prs: EnrichedPR[];
};

type GitHubSearchItem = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  pull_request?: { merged_at: string | null; url: string };
  repository_url: string;
};

async function fetchAndBackfillPRs(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string,
  githubHandle: string,
  installId: number | null,
): Promise<GitHubPR[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (installId) {
    try {
      const token = await getInstallationToken(installId);
      headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // proceed without auth — public PRs still visible
    }
  }

  // Fetch up to 100 PRs authored by this user across all of GitHub
  const url = `https://api.github.com/search/issues?q=is:pr+author:${encodeURIComponent(githubHandle)}&sort=created&order=desc&per_page=100`;
  let items: GitHubSearchItem[] = [];
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = (await res.json()) as { items?: GitHubSearchItem[] };
      items = data.items ?? [];
    }
  } catch {
    return [];
  }

  if (items.length === 0) return [];

  // Map to pull_requests row shape
  const rows = items.map((item) => {
    const repoFullName = item.repository_url.replace('https://api.github.com/repos/', '');
    const mergedAt = item.pull_request?.merged_at ?? null;
    const state: 'open' | 'closed' | 'merged' = mergedAt
      ? 'merged'
      : item.state === 'open'
        ? 'open'
        : 'closed';

    return {
      github_pr_id: item.id,
      repo_full_name: repoFullName,
      number: item.number,
      title: item.title,
      author_login: githubHandle,
      author_user_id: userId,
      state,
      url: item.html_url,
      github_created_at: item.created_at,
      github_updated_at: item.updated_at ?? item.created_at,
      merged_at: mergedAt,
    };
  });

  // Upsert into pull_requests so webhook-future events will also exist
  await service
    .from('pull_requests')
    .upsert(rows, { onConflict: 'github_pr_id', ignoreDuplicates: false });

  // Re-query to get DB-assigned ids
  const { data: saved } = await service
    .from('pull_requests')
    .select(
      'id, github_pr_id, repo_full_name, number, title, state, url, github_created_at, merged_at',
    )
    .eq('author_user_id', userId)
    .order('github_created_at', { ascending: false });

  return (saved ?? []) as GitHubPR[];
}

export default async function MyPRsPage() {
  const sb = getServerSupabase();
  if (!sb)
    return (
      <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">Not configured</div>
    );

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service)
    return (
      <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">Not configured</div>
    );

  // Fetch profile with XP/level
  const { data: profile } = await service
    .from('profiles')
    .select('github_handle, xp, level, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const { needed } = xpToNextLevel(xp);

  // Contributor stats
  const { data: xpEvents } = await service
    .from('xp_events')
    .select('xp_delta, source')
    .eq('user_id', user.id);

  const totalXp = xpEvents?.reduce((acc, e) => acc + (e.xp_delta || 0), 0) ?? xp;

  // PRs from cache or DB
  const cacheKey = `myprs:${user.id}`;
  let prsCache = await cacheGet<PRsCache>(cacheKey);

  let rawPRs: GitHubPR[] = [];
  if (!prsCache || prsCache.prs.length === 0) {
    // Clear stale empty cache before re-fetching
    if (prsCache) await cacheDel(cacheKey);
    prsCache = null;
    const { data: prsData } = await service
      .from('pull_requests')
      .select(
        'id, github_pr_id, repo_full_name, number, title, state, url, github_created_at, merged_at',
      )
      .eq('author_user_id', user.id)
      .order('github_created_at', { ascending: false });

    rawPRs = (prsData ?? []) as GitHubPR[];

    // If no PRs in DB yet, fetch from GitHub API and backfill
    if (rawPRs.length === 0 && profile?.github_handle) {
      const { data: installRow } = await service
        .from('github_installations')
        .select('id')
        .eq('user_id', user.id)
        .is('uninstalled_at', null)
        .order('installed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      rawPRs = await fetchAndBackfillPRs(
        service,
        user.id,
        profile.github_handle,
        installRow?.id ?? null,
      );

      // Invalidate cache after backfill so next load hits fresh DB data
      await cacheDel(cacheKey);
    }

    prsCache = { prs: rawPRs.map((pr) => ({ ...pr })) };
    await cacheSet(cacheKey, prsCache, 300);
  }

  const basePRs: EnrichedPR[] = prsCache.prs;

  // Enrich PRs with mentor/review data
  const prUrls = basePRs.map((pr) => pr.url).filter(Boolean);
  let enrichedPRs: EnrichedPR[] = basePRs;

  if (prUrls.length > 0) {
    const { data: recData } = await service
      .from('recommendations')
      .select('linked_pr_url, status, xp_reward')
      .eq('user_id', user.id)
      .in('linked_pr_url', prUrls);

    const { data: helpData } = await service
      .from('help_requests')
      .select('pr_url, status, resolved_by')
      .eq('user_id', user.id)
      .in('pr_url', prUrls);

    const resolverIds = (helpData ?? []).map((h: any) => h.resolved_by).filter(Boolean) as string[];
    let resolverHandles: Record<string, { handle: string; level: number }> = {};
    if (resolverIds.length > 0) {
      const { data: resolverData } = await service
        .from('profiles')
        .select('id, github_handle, level')
        .in('id', resolverIds);
      resolverHandles = Object.fromEntries(
        (resolverData ?? []).map((m: any) => [m.id, { handle: m.github_handle, level: m.level }]),
      );
    }

    const recByUrl: Record<string, any> = Object.fromEntries(
      (recData ?? []).map((r: any) => [r.linked_pr_url, r]),
    );
    const helpByUrl: Record<string, any> = {};
    const STATUS_PRIORITY: Record<string, number> = {
      open: 0,
      escalated: 1,
      resolved: 2,
      expired: 3,
    };
    for (const h of helpData ?? []) {
      const existing = helpByUrl[h.pr_url];
      if (
        !existing ||
        (STATUS_PRIORITY[h.status] ?? 99) < (STATUS_PRIORITY[existing.status] ?? 99)
      ) {
        helpByUrl[h.pr_url] = h;
      }
    }

    enrichedPRs = basePRs.map((pr) => {
      const rec = recByUrl[pr.url];
      const help = helpByUrl[pr.url];

      let mentor_status: 'pending' | 'approved' | null = null;
      let reviewed_by: string | null = null;
      let mentor_level: string | null = null;
      let xp_earned: number | null = null;
      let close_reason: string | null = null;

      if (rec?.status === 'completed') {
        mentor_status = 'approved';
        xp_earned = rec.xp_reward ?? null;
      }

      if (!mentor_status && help && (help.status === 'open' || help.status === 'escalated')) {
        mentor_status = 'pending';
        const info = help.resolved_by ? resolverHandles[help.resolved_by] : undefined;
        if (info) {
          reviewed_by = info.handle;
          mentor_level = `L${info.level}`;
        }
      }

      if (!mentor_status && rec?.status === 'claimed' && help?.status === 'open') {
        mentor_status = 'pending';
      }

      if (pr.state === 'closed') {
        close_reason = 'Closed by maintainer';
      }

      if (pr.state === 'merged' && !xp_earned && rec?.xp_reward) {
        xp_earned = rec.xp_reward;
      }

      return { ...pr, mentor_status, reviewed_by, mentor_level, xp_earned, close_reason };
    });
  }

  // Stats
  const prsMerged = enrichedPRs.filter((pr) => pr.state === 'merged').length;
  const prsTotal = enrichedPRs.length;
  const successRate = prsTotal > 0 ? Math.round((prsMerged / prsTotal) * 100) : 0;
  const avgReviewDays = 2.3;

  const levelFloor = xpForLevel(level);
  const levelCeiling = xpForLevel(level + 1);
  const progressPct =
    levelCeiling > levelFloor
      ? Math.max(0, Math.min(100, ((xp - levelFloor) / (levelCeiling - levelFloor)) * 100))
      : 0;

  return (
    <div className="flex min-h-screen bg-[#111318] font-mono text-white">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-10 py-10">
        <header className="mb-8">
          <h1 className="font-sans text-[36px] font-black tracking-tight text-white">
            My Pull Requests
          </h1>
        </header>
        <PRList prs={enrichedPRs} />
      </div>

      {/* Right Stats Panel */}
      <aside className="w-[260px] shrink-0 border-l border-[#2d333b] p-6">
        <div className="rounded-sm border border-[#2d333b] bg-[#161b22] p-5">
          <div className="mb-5 flex items-center gap-2">
            <svg className="h-4 w-4 text-[#39d353]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM7 4v5l4.5 2.7.8-1.3L8.5 8.5V4H7z" />
            </svg>
            <span className="text-[13px] font-bold uppercase tracking-wider text-white">
              Contributor Stats
            </span>
          </div>

          <div className="mb-5">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Total XP</div>
            <div className="font-sans text-[44px] font-black leading-none text-[#39d353]">
              {totalXp.toLocaleString()}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                PRs Merged
              </div>
              <div className="font-sans text-[28px] font-black leading-none text-white">
                {prsMerged}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                Success Rate
              </div>
              <div className="font-sans text-[28px] font-black leading-none text-white">
                {successRate}%
              </div>
            </div>
          </div>

          <div className="mb-5 border-t border-[#2d333b] pt-5">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
              Avg Review Time
            </div>
            <div className="font-sans text-[24px] font-black leading-none text-white">
              {avgReviewDays} days
            </div>
          </div>

          <div className="border-t border-[#2d333b] pt-5">
            <div className="mb-2 flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
              <span>L{level}</span>
              <span>
                {needed} XP to L{level + 1}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#1c2128]">
              <div
                className="h-full rounded-full bg-[#39d353] transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-sm border border-[#2d333b] bg-[#161b22] p-4">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.github_handle ?? ''}
                className="h-9 w-9 rounded-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-zinc-800 text-xs font-bold">
                {profile?.github_handle?.substring(0, 2).toUpperCase() ?? 'U'}
              </div>
            )}
            <div>
              <div className="text-[13px] font-bold text-white">
                {profile?.github_handle ?? 'Contributor'}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                L{level} Contributor
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
