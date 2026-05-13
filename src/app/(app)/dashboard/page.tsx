import { getRecommendations } from '@/app/actions/recommendations';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { isOk } from '@/lib/result';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Box } from 'lucide-react';

export const dynamic = 'force-dynamic';

const DIFFICULTY_LABEL: Record<string, string> = { E: 'L1', M: 'L2', H: 'L3' };

export default async function DashboardPage() {
  const sb = getServerSupabase();
  if (!sb) {
    return <NotConfigured />;
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service) return <NotConfigured />;

  const { data: profile } = await service
    .from('profiles')
    .select('github_handle, xp, level, audit_completed')
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const { needed, next } = xpToNextLevel(xp);
  const nextLevel = next ?? level;

  const recsResult = await getRecommendations();
  let recs: any[] = [];
  if (isOk(recsResult)) {
    recs = recsResult.data.slice(0, 2);
  }

  // Total Merges
  const { count: mergesCount } = await service
    .from('xp_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('source', ['recommended_merge', 'unrecommended_merge']);

  // Mentor points
  const { data: mentorEvents } = await service
    .from('xp_events')
    .select('xp_delta')
    .eq('user_id', user.id)
    .in('source', ['review', 'help_review']);
  const mentorPoints = mentorEvents?.reduce((acc, e) => acc + (e.xp_delta || 0), 0) || 0;

  // Streak
  const { count: streakCount } = await service
    .from('xp_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'streak');
  const streak = streakCount || 0;

  // Leaderboard
  const { data: leaders } = await service
    .from('profiles')
    .select('github_handle, xp')
    .order('xp', { ascending: false })
    .limit(4);

  // My PRs (only active or completed work)
  const { data: myPrsData } = await service
    .from('recommendations')
    .select(
      `
      id,
      status,
      xp_reward,
      linked_pr_url,
      issues (
        title,
        repo_full_name
      )
    `,
    )
    .eq('user_id', user.id)
    .in('status', ['claimed', 'completed'])
    .limit(3);

  // Mentees
  const { data: menteesData } = await service
    .from('help_requests')
    .select(`id, pr_url, status, user_id`)
    .eq('resolved_by', user.id)
    .in('status', ['open', 'escalated'])
    .limit(2);

  // Enrich mentees with handles
  let enrichedMentees: any[] = [];
  if (menteesData && menteesData.length > 0) {
    const userIds = menteesData.map((m: any) => m.user_id);
    const { data: menteeProfiles } = await service
      .from('profiles')
      .select('id, github_handle')
      .in('id', userIds);

    enrichedMentees = menteesData.map((m: any) => {
      const p = menteeProfiles?.find((p) => p.id === m.user_id);
      return { ...m, github_handle: p?.github_handle || 'Unknown' };
    });
  }

  // Orgs for dropdown
  const { data: insts } = await service
    .from('github_installations')
    .select(
      `
      account_login,
      installation_repositories (
        repo_full_name
      )
    `,
    )
    .eq('user_id', user.id);

  const orgs = new Set<string>();
  insts?.forEach((inst: any) => {
    if (inst.account_login) orgs.add(inst.account_login);
    inst.installation_repositories?.forEach((repo: any) => {
      const org = repo.repo_full_name?.split('/')[0];
      if (org) orgs.add(org);
    });
  });
  const orgList = Array.from(orgs);

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-12 flex flex-col justify-between gap-6 border-b border-[#2d333b] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              01 / DASHBOARD
            </div>
            <h1 className="font-serif text-4xl text-white">
              Welcome back, {profile?.github_handle ?? 'Contributor'}.
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {orgList.length > 0 && (
              <select className="cursor-pointer appearance-none border border-zinc-700 bg-[#1c2128] px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300 focus:border-[#10b981] focus:outline-none">
                <option value="all">All Organizations</option>
                {orgList.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        {/* Stats Row */}
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Level Progress */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              LEVEL PROGRESS
            </div>
            <div className="flex items-center gap-4">
              <div className="border border-zinc-700 px-3 py-2 font-serif text-xl text-zinc-300">
                L{level}
              </div>
              <div className="flex-1">
                <div className="mb-2 h-1.5 w-full overflow-hidden bg-[#1c2128]">
                  <div
                    className="h-full bg-[#10b981]"
                    style={{ width: `${levelProgressPct(xp, level)}%` }}
                  />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {xp.toLocaleString()} / {(xp + needed).toLocaleString()} XP TO L{nextLevel}
                </div>
              </div>
            </div>
          </div>

          {/* Total Merges */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              TOTAL MERGES
            </div>
            <div className="flex items-end gap-2">
              <span className="font-serif text-4xl leading-none">
                {(mergesCount || 0).toString().padStart(2, '0')}
              </span>
              <TrendingUp className="mb-1 h-4 w-4 text-[#10b981]" />
            </div>
          </div>

          {/* Mentor Points */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              MENTOR POINTS
            </div>
            <div className="flex items-end gap-2">
              <span className="font-serif text-4xl leading-none">
                {mentorPoints.toLocaleString()}
              </span>
              <Box className="mb-1 h-5 w-5 text-zinc-400" />
            </div>
          </div>

          {/* Current Streak */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              CURRENT STREAK
            </div>
            <div className="flex items-end gap-2">
              <span className="font-serif text-4xl leading-none">
                {streak.toString().padStart(2, '0')}
              </span>
              <span className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                DAYS 🔥
              </span>
            </div>
          </div>
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-16">
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  ACTIVE ISSUES
                </h2>
                <Link
                  href="/issues"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white"
                >
                  BROWSE MORE <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-6">
                {recs.length > 0 ? (
                  recs.map((rec, i) => (
                    <div
                      key={rec.id || i}
                      className="border-b border-[#2d333b] pb-6 last:border-0 last:pb-0"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex gap-3">
                          <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                            {rec.repoFullName?.split('/')[1] || 'REPO'}
                          </span>
                          <span className="bg-white px-2 py-0.5 text-[10px] font-bold text-black">
                            {DIFFICULTY_LABEL[rec.difficulty] ?? rec.difficulty}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                          RECOMMENDED
                        </span>
                      </div>
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-5 block font-serif text-2xl text-white hover:text-zinc-300"
                      >
                        {rec.title}
                      </a>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
                        <div className="h-2 w-2 bg-white" />
                        AVAILABLE FOR YOU
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-sm text-zinc-500">
                    No active issues. Check recommendations to claim one.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-6 border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  YOUR MENTEES
                </h2>
              </div>
              <div className="space-y-4">
                {enrichedMentees && enrichedMentees.length > 0 ? (
                  enrichedMentees.map((mentee: any) => (
                    <div
                      key={mentee.id}
                      className="flex items-center justify-between border-b border-[#2d333b] pb-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center border border-zinc-800 bg-[#1c2128] text-xs uppercase text-zinc-500">
                          {mentee.github_handle.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                            {mentee.github_handle}
                          </div>
                          <div className="text-sm text-zinc-400">Help Request: {mentee.status}</div>
                        </div>
                      </div>
                      <Link
                        href={mentee.pr_url || '#'}
                        className="border border-zinc-700 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        REVIEW DRAFT
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    No active mentees assigned to you.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-16">
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">MY PRS</h2>
                <Link
                  href="/my-prs"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white"
                >
                  VIEW ALL <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-8">
                {myPrsData && myPrsData.length > 0 ? (
                  myPrsData.map((pr: any) => {
                    const issue = pr.issues;
                    const repo = issue?.repo_full_name?.split('/')[1] || 'UNKNOWN';
                    const isMerged = pr.status === 'completed';
                    return (
                      <div key={pr.id} className="border-b border-[#2d333b] pb-6 last:border-0">
                        <h3 className="mb-2 text-[17px] text-white">
                          {issue?.title || 'Unknown PR'}
                        </h3>
                        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
                          #{pr.id} • {repo}
                        </div>
                        <div className="flex items-center justify-between">
                          {isMerged ? (
                            <>
                              <div className="inline-block border border-[#10b981] bg-[#064e3b]/30 px-2 py-1 text-[10px] uppercase tracking-widest text-[#10b981]">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 bg-[#10b981]" /> MERGED ✓
                                </div>
                              </div>
                              <span className="text-[11px] uppercase tracking-widest text-[#10b981]">
                                +{pr.xp_reward || 0} XP
                              </span>
                            </>
                          ) : (
                            <div className="inline-block border border-[#b45309] bg-[#451a03]/30 px-2 py-1 text-[10px] uppercase tracking-widest text-[#fbbf24]">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 bg-[#fbbf24]" />{' '}
                                {pr.status.replace('_', ' ')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    No PRs tracked yet.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  LEADERBOARD SNAPSHOT
                </h2>
                <span className="text-[11px] uppercase tracking-widest text-zinc-500">GLOBAL</span>
              </div>

              <div className="text-xs uppercase tracking-widest">
                {leaders && leaders.length > 0 ? (
                  leaders.map((leader, index) => {
                    const isMe = leader.github_handle === profile?.github_handle;
                    return (
                      <div
                        key={leader.github_handle}
                        className={`flex justify-between border-b border-[#2d333b] py-3.5 ${isMe ? '-mx-3 bg-[#3b0764]/40 px-3 text-purple-300' : 'text-zinc-400'}`}
                      >
                        <div className="flex gap-5">
                          <span className={`w-6 ${isMe ? 'opacity-50' : 'text-zinc-600'}`}>
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          {leader.github_handle} {isMe && '(YOU)'}
                        </div>
                        <span>{leader.xp.toLocaleString()} XP</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    Leaderboard is empty.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 flex justify-between border-t border-[#2d333b] pt-8 text-[10px] uppercase tracking-widest text-zinc-600">
          <span>©2024 ARCH_06 / SYSTEM_v1.0</span>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-zinc-400">
              TERMS
            </Link>
            <Link href="#" className="transition-colors hover:text-zinc-400">
              PRIVACY
            </Link>
            <Link href="#" className="transition-colors hover:text-zinc-400">
              SECURITY
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function levelProgressPct(xp: number, level: number): number {
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  if (ceiling <= floor) return 100;
  const pct = ((xp - floor) / (ceiling - floor)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function NotConfigured() {
  return (
    <div className="min-h-screen bg-[#111318] px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 font-serif text-3xl font-bold">Dashboard not configured</h1>
        <p className="text-gray-400">Auth isn&apos;t wired on this deployment yet.</p>
      </div>
    </div>
  );
}
