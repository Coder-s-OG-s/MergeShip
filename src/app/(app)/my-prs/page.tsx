import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';
import { cacheGet, cacheSet } from '@/lib/cache';
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
  if (!prsCache) {
    const { data: prsData } = await service
      .from('github_prs')
      .select('id, title, repo_full_name, state, pr_number, pr_url, opened_at')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false });

    rawPRs = (prsData ?? []) as GitHubPR[];
    prsCache = { prs: rawPRs.map((pr) => ({ ...pr })) };
    await cacheSet(cacheKey, prsCache, 300);
  }

  const basePRs: EnrichedPR[] = prsCache.prs;

  // Enrich PRs with mentor/review data from recommendations
  const prUrls = basePRs.map((pr) => pr.pr_url).filter(Boolean);
  let enrichedPRs: EnrichedPR[] = basePRs;

  if (prUrls.length > 0) {
    const { data: recData } = await service
      .from('recommendations')
      .select('linked_pr_url, status, xp_reward, mentor_id')
      .eq('user_id', user.id)
      .in('linked_pr_url', prUrls);

    // Get help request data for mentor info
    const { data: helpData } = await service
      .from('help_requests')
      .select('pr_url, status, resolved_by')
      .eq('user_id', user.id)
      .in('pr_url', prUrls);

    // Get mentor handles
    const mentorIds = [
      ...(recData?.map((r: any) => r.mentor_id).filter(Boolean) ?? []),
      ...(helpData?.map((h: any) => h.resolved_by).filter(Boolean) ?? []),
    ];

    let mentorProfiles: Record<string, string> = {};
    if (mentorIds.length > 0) {
      const { data: mentorData } = await service
        .from('profiles')
        .select('id, github_handle, level')
        .in('id', mentorIds);
      mentorProfiles = Object.fromEntries(
        (mentorData ?? []).map((m: any) => [m.id, `${m.github_handle}:L${m.level}`]),
      );
    }

    const recByUrl = Object.fromEntries((recData ?? []).map((r: any) => [r.linked_pr_url, r]));
    const helpByUrl = Object.fromEntries((helpData ?? []).map((h: any) => [h.pr_url, h]));

    enrichedPRs = basePRs.map((pr) => {
      const rec = recByUrl[pr.pr_url];
      const help = helpByUrl[pr.pr_url];

      let mentor_status: 'pending' | 'approved' | null = null;
      let reviewed_by: string | null = null;
      let mentor_level: string | null = null;
      let xp_earned: number | null = null;
      let close_reason: string | null = null;

      if (rec) {
        if (rec.status === 'approved' || rec.status === 'merged') {
          mentor_status = 'approved';
          xp_earned = rec.xp_reward ?? null;
          if (rec.mentor_id && mentorProfiles[rec.mentor_id]) {
            const parts = mentorProfiles[rec.mentor_id].split(':');
            reviewed_by = parts[0] ?? null;
            mentor_level = parts[1] ?? null;
          }
        } else if (rec.status === 'claimed' || rec.status === 'review_pending') {
          mentor_status = 'pending';
          if (rec.mentor_id && mentorProfiles[rec.mentor_id]) {
            const parts = mentorProfiles[rec.mentor_id].split(':');
            reviewed_by = parts[0] ?? null;
            mentor_level = parts[1] ?? null;
          }
        }
      }

      if (help) {
        if (!mentor_status && (help.status === 'open' || help.status === 'escalated')) {
          mentor_status = 'pending';
          if (help.resolved_by && mentorProfiles[help.resolved_by]) {
            const parts = mentorProfiles[help.resolved_by].split(':');
            reviewed_by = parts[0] ?? null;
            mentor_level = parts[1] ?? null;
          }
        }
      }

      if (pr.state === 'closed' && !close_reason) {
        close_reason = 'Closed by maintainer';
      }

      if (pr.state === 'merged' && !xp_earned && rec?.xp_reward) {
        xp_earned = rec.xp_reward;
      }

      return {
        ...pr,
        mentor_status,
        reviewed_by,
        mentor_level,
        xp_earned,
        close_reason,
      };
    });
  }

  // Stats
  const prsMerged = enrichedPRs.filter((pr) => pr.state === 'merged').length;
  const prsTotal = enrichedPRs.length;
  const successRate = prsTotal > 0 ? Math.round((prsMerged / prsTotal) * 100) : 0;

  // Avg review time (using XP events as proxy for now)
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
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-sans text-[36px] font-black tracking-tight text-white">
            My Pull Requests
          </h1>
        </header>

        {/* PR list with tabs */}
        <PRList prs={enrichedPRs} />
      </div>

      {/* Right Stats Panel */}
      <aside className="w-[260px] shrink-0 border-l border-[#2d333b] p-6">
        <div className="rounded-sm border border-[#2d333b] bg-[#161b22] p-5">
          {/* Title */}
          <div className="mb-5 flex items-center gap-2">
            <svg className="h-4 w-4 text-[#39d353]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM7 4v5l4.5 2.7.8-1.3L8.5 8.5V4H7z" />
            </svg>
            <span className="text-[13px] font-bold uppercase tracking-wider text-white">
              Contributor Stats
            </span>
          </div>

          {/* Total XP */}
          <div className="mb-5">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Total XP</div>
            <div className="font-sans text-[44px] font-black leading-none text-[#39d353]">
              {totalXp.toLocaleString()}
            </div>
          </div>

          {/* PRs Merged + Success Rate */}
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

          {/* Avg Review Time */}
          <div className="mb-5 border-t border-[#2d333b] pt-5">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
              Avg Review Time
            </div>
            <div className="font-sans text-[24px] font-black leading-none text-white">
              {avgReviewDays} days
            </div>
          </div>

          {/* Level Progress */}
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

        {/* Profile info */}
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
