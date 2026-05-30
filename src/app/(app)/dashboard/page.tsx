import { Suspense } from 'react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { SyncButton } from './sync-button';
import LevelUpBanner from './level-up-banner';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Component imports
import StatsRow, { StatsSkeleton } from './stats-row';
import ActiveIssuesSection, { RecsSkeleton } from './active-issues';
import GitHubPRsWrapper, { PrsSkeleton } from './github-prs-wrapper';
import LeaderboardSnapshot, { LeaderboardSkeleton } from './leaderboard-snapshot';
import MenteesSection, { MenteesSkeleton } from './mentees-section';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = await getServerSupabase();
  if (!sb) {
    return <NotConfigured />;
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service) return <NotConfigured />;

  // Fetch only the profile info we need for the page shell header and subcomponents
  const { data: profile } = await service
    .from('profiles')
    .select('github_handle, xp, level, github_total_merges, github_streak, github_stats_synced_at')
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const { needed, next } = xpToNextLevel(xp);
  const nextLevel = next ?? level;

  // Read stats from Redis cache, fall back to profile data
  const cacheKey = `gh:dashboard:${user.id}`;
  let dashCache = await cacheGet<DashboardCache>(cacheKey);

  if (!dashCache) {
    dashCache = {
      merges: (profile?.github_total_merges as number | null) ?? null,
      streak: (profile?.github_streak as number | null) ?? null,
      syncedAt: (profile?.github_stats_synced_at as string | null) ?? null,
    };
    await cacheSet(cacheKey, dashCache, 300);
  }

  // Query pull_requests directly (populated by webhooks)
  const { data: prsData } = await service
    .from('pull_requests')
    .select(
      'id, github_pr_id, repo_full_name, number, title, state, url, github_created_at, merged_at',
    )
    .eq('author_user_id', user.id)
    .order('github_created_at', { ascending: false });

  const prs = (prsData ?? []) as GitHubPR[];

  // Active Issues: claimed recommendations only
  const { data: claimedRecs } = await service
    .from('recommendations')
    .select(
      `
      id,
      status,
      xp_reward,
      linked_pr_url,
      difficulty,
      issues (
        title,
        repo_full_name,
        url
      )
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'claimed')
    .limit(2);

  const claimedPrUrls = (claimedRecs ?? [])
    .map((r: any) => r.linked_pr_url)
    .filter(Boolean) as string[];

  const recsResult = await getRecommendations();
  let recs: any[] = [];
  if (isOk(recsResult)) {
    recs = recsResult.data;
  }

  // Mentor points
  const { data: mentorEvents } = await service
    .from('xp_events')
    .select('xp_delta')
    .eq('user_id', user.id)
    .in('source', ['review', 'help_review']);
  const mentorPoints = mentorEvents?.reduce((acc, e) => acc + (e.xp_delta || 0), 0) || 0;

  // Leaderboard
  // Leaderboard
  const { data: leaders } = await service
    .from('profiles')
    .select('github_handle, xp')
    .order('xp', { ascending: false })
    .limit(4);

  // Get all profiles to calculate current user's rank
  const { data: allProfiles } = await service
    .from('profiles')
    .select('github_handle, xp')
    .order('xp', { ascending: false });

  const currentUserRank =
    allProfiles?.findIndex((p: any) => p.github_handle === profile?.github_handle) ?? -1;

  const myLeaderboardEntry =
    currentUserRank >= 0
      ? {
          github_handle: profile?.github_handle ?? 'You',
          xp,
          rank: currentUserRank + 1,
        }
      : null;

  const isUserVisible = leaders?.some(
    (leader: any) => leader.github_handle === profile?.github_handle,
  );

  // Mentees
  const { data: menteesData } = await service
    .from('help_requests')
    .select('id, pr_url, status, user_id')
    .eq('resolved_by', user.id)
    .in('status', ['open', 'escalated'])
    .limit(2);

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

  const merges = dashCache.merges;
  const streak = dashCache.streak;
  const syncedAt = dashCache.syncedAt;

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        <LevelUpBanner />
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
            <SyncButton lastSyncedAt={profile?.github_stats_synced_at ?? null} userId={user.id} />
          </div>
        </header>

        {/* Stats Row */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsRow userId={user.id} profile={profile} />
        </Suspense>

        {/* Main Columns */}
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-16">
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  LEADERBOARD SNAPSHOT
                </h2>

                <span className="text-[11px] uppercase tracking-widest text-zinc-500">GLOBAL</span>
              </div>

              <div className="text-xs uppercase tracking-widest">
                {leaders && leaders.length > 0 ? (
                  <>
                    {leaders.map((leader: any, index: number) => {
                      const isMe = leader.github_handle === profile?.github_handle;

                      return (
                        <div
                          key={leader.github_handle}
                          className={`flex justify-between border-b border-[#2d333b] py-3.5 ${
                            isMe ? '-mx-3 bg-[#3b0764]/40 px-3 text-purple-300' : 'text-zinc-400'
                          }`}
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
                    })}

                    {!isUserVisible && myLeaderboardEntry && (
                      <>
                        <div className="border-t border-[#3f3f46] pb-2 pt-5">
                          <span className="text-[10px] tracking-[0.3em] text-zinc-500">
                            YOUR RANK
                          </span>
                        </div>

                        <div className="-mx-3 flex justify-between bg-[#3b0764]/30 px-3 py-3.5 text-purple-300">
                          <div className="flex gap-5">
                            <span className="w-6 opacity-50">
                              {myLeaderboardEntry.rank.toString().padStart(2, '0')}
                            </span>
                            {myLeaderboardEntry.github_handle} (YOU)
                          </div>

                          <span>{myLeaderboardEntry.xp.toLocaleString()} XP</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    Leaderboard is empty.
                  </div>
                )}
              </div>
            </section>

            <Suspense fallback={<MenteesSkeleton />}>
              <MenteesSection userId={user.id} />
            </Suspense>
          </div>

          {/* Right Column */}
          <div className="space-y-16">
            <Suspense fallback={<PrsSkeleton />}>
              <GitHubPRsWrapper userId={user.id} githubHandle={profile?.github_handle ?? ''} />
            </Suspense>
            <Suspense fallback={<LeaderboardSkeleton />}>
              <LeaderboardSnapshot githubHandle={profile?.github_handle ?? ''} />
            </Suspense>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 flex justify-between border-t border-[#2d333b] pt-8 text-[10px] uppercase tracking-widest text-zinc-600">
          <span>©{new Date().getFullYear()} ARCH_06 / SYSTEM_v1.0</span>
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
