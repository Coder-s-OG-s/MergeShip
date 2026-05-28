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

  // Fetch only the profile info we need for the page shell header and subcomponents
  const { data: profile } = await service
    .from('profiles')
    .select('github_handle, xp, level, github_total_merges, github_streak, github_stats_synced_at')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#111318] px-4 py-8 font-mono text-white sm:px-6 md:px-12 md:py-12">
      <div className="mx-auto max-w-6xl">
        <LevelUpBanner />
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-[#2d333b] pb-4 md:mb-12 md:gap-6 md:pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
              01 / DASHBOARD
            </div>
            <h1 className="font-serif text-2xl text-white sm:text-3xl md:text-4xl">
              Welcome back, {profile?.github_handle ?? 'Contributor'}.
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <SyncButton lastSyncedAt={profile?.github_stats_synced_at ?? null} userId={user.id} />
          </div>
        </header>

        {/* Stats Row */}
        <Suspense fallback={<StatsSkeleton />}>
          <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mb-16 md:gap-12 lg:grid-cols-4">
            {/* Level Progress */}
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
                LEVEL PROGRESS
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="border border-zinc-700 px-3 py-2 font-serif text-lg sm:text-xl text-zinc-300">
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
              <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
                TOTAL MERGES
              </div>
              <div className="flex items-end gap-2">
                <span className="font-serif text-3xl leading-none sm:text-4xl">
                  {(merges ?? 0).toString().padStart(2, '0')}
                </span>
                <TrendingUp className="mb-1 h-4 w-4 text-[#10b981]" />
              </div>
            </div>

            {/* Mentor Points */}
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
                MENTOR POINTS
              </div>
              <div className="flex items-end gap-2">
                <span className="font-serif text-3xl leading-none sm:text-4xl">
                  {mentorPoints.toLocaleString()}
                </span>
                <Box className="mb-1 h-5 w-5 text-zinc-400" />
              </div>
            </div>

            {/* Current Streak */}
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
                CURRENT STREAK
              </div>
              <div className="flex items-end gap-2">
                <span className="font-serif text-3xl leading-none sm:text-4xl">
                  {(streak ?? 0).toString().padStart(2, '0')}
                </span>
                <span className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  DAYS 🔥
                </span>
              </div>
            </div>
          </div>
          <StatsRow userId={user.id} profile={profile} />
        </Suspense>

        {/* Main Columns */}
        <div className="grid grid-cols-1 gap-12 md:gap-16 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-12 md:space-y-16">
            <section>
              <div className="mb-4 flex flex-col items-start justify-between gap-2 border-b border-[#2d333b] pb-3 md:mb-6 md:flex-row md:items-center md:gap-0 md:pb-4">
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

              {recs.length > 0 ? (
                <RecCards recs={recs} />
              ) : (
                <div className="py-4 text-sm text-zinc-500">
                  No recommendations yet. Check back soon.
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 border-b border-[#2d333b] pb-3 md:mb-6 md:pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  YOUR MENTEES
                </h2>
              </div>
              <div className="space-y-4">
                {enrichedMentees && enrichedMentees.length > 0 ? (
                  enrichedMentees.map((mentee: any) => (
                    <div
                      key={mentee.id}
                      className="flex flex-col gap-3 border-b border-[#2d333b] pb-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
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
                        className="w-full border border-zinc-700 px-4 py-2 text-center text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800 sm:w-auto"
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
          <div className="space-y-12 md:space-y-16">
            <GitHubPRsPanel
              prs={prs}
              claimedPrUrls={claimedPrUrls}
              githubHandle={profile?.github_handle ?? ''}
            />

            <section>
              <div className="mb-4 flex items-center justify-between border-b border-[#2d333b] pb-3 md:mb-6 md:pb-4">
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
                        className={`flex justify-between border-b border-[#2d333b] py-3 md:py-3.5 ${isMe ? '-mx-2 bg-[#3b0764]/40 px-2 text-purple-300 md:-mx-3 md:px-3' : 'text-zinc-400'}`}
                      >
                        <div className="flex gap-3 md:gap-5">
                          <span className={`w-6 ${isMe ? 'opacity-50' : 'text-zinc-600'}`}>
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="truncate">
                            {leader.github_handle} {isMe && '(YOU)'}
                          </span>
                        </div>
                        <span className="ml-2">{leader.xp.toLocaleString()} XP</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    BE THE FIRST ON THE BOARD — MERGE A PR TO EARN XP
                  </div>
                )}
              </div>
            </section>
          <div className="space-y-16">
            <Suspense fallback={<RecsSkeleton />}>
              <ActiveIssuesSection />
            </Suspense>

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
        <footer className="mt-16 flex flex-col gap-4 border-t border-[#2d333b] pt-6 text-[10px] uppercase tracking-widest text-zinc-600 md:mt-24 md:flex-row md:justify-between md:pt-8">
          <span>©{new Date().getFullYear()} ARCH_06 / SYSTEM_v1.0</span>
          <div className="flex gap-4 sm:gap-6">
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

function StatsSkeleton() {
  return (
    <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mb-16 md:gap-12 lg:grid-cols-4">
      {/* Level Progress Skeleton */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
          LEVEL PROGRESS
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="h-11 w-12 animate-pulse border border-zinc-700 bg-zinc-800" />
          <div className="flex-1">
            <div className="mb-2 h-1.5 w-full animate-pulse bg-zinc-800" />
            <div className="h-3 w-3/4 animate-pulse bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Total Merges Skeleton */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">TOTAL MERGES</div>
        <div className="flex items-end gap-2">
          <div className="h-8 w-16 animate-pulse rounded bg-zinc-800 sm:h-9" />
          <div className="mb-1 h-4 w-4 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>

      {/* Mentor Points Skeleton */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
          MENTOR POINTS
        </div>
        <div className="flex items-end gap-2">
          <div className="h-8 w-24 animate-pulse rounded bg-zinc-800 sm:h-9" />
          <div className="mb-1 h-5 w-5 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>

      {/* Current Streak Skeleton */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500 md:mb-4">
          CURRENT STREAK
        </div>
        <div className="flex items-end gap-2">
          <div className="h-8 w-16 animate-pulse rounded bg-zinc-800 sm:h-9" />
          <div className="mb-1 h-4 w-12 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
