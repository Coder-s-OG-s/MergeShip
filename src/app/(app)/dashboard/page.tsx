import { Suspense } from 'react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { SyncButton } from './sync-button';
import LevelUpBanner from './level-up-banner';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Existing dashboard components
import StatsRow, { StatsSkeleton } from './stats-row';
import ActiveIssuesSection, { RecsSkeleton } from './active-issues';
import GitHubPRsWrapper, { PrsSkeleton } from './github-prs-wrapper';
import LeaderboardSnapshot, { LeaderboardSkeleton } from './leaderboard-snapshot';
import MenteesSection, { MenteesSkeleton } from './mentees-section';
import OnboardingChecklist from './onboarding-checklist';
import TrendingRepos, { TrendingReposSkeleton } from './trending-repos';
import RepositoryMatches, { RepositoryMatchesSkeleton } from './repository-matches';

// New contributor-dashboard components
import {
  ProfileSidebar,
  ProfileSidebarSkeleton,
} from '@/components/contributor-dashboard/profile-sidebar';
import JourneyProgress, {
  JourneyProgressSkeleton,
} from '@/components/contributor-dashboard/journey-progress';
import RecentActivity, {
  RecentActivitySkeleton,
} from '@/components/contributor-dashboard/recent-activity';
import HeatmapWrapper, {
  HeatmapSkeleton,
} from '@/components/contributor-dashboard/heatmap-wrapper';
import { DailyChallenge } from '@/components/contributor-dashboard/daily-challenge';
import { CourseProgress } from '@/components/contributor-dashboard/course-progress';
import {
  RightSidebar,
  RightSidebarSkeleton,
} from '@/components/contributor-dashboard/right-sidebar';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = await getServerSupabase();
  if (!sb) return <NotConfigured />;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service) return <NotConfigured />;

  const { data: profile } = await service
    .from('profiles')
    .select(
      'github_handle, xp, level, github_total_merges, github_streak, github_stats_synced_at, primary_language',
    )
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const githubHandle = profile?.github_handle ?? 'Contributor';

  const { count: claimedCount } = await service
    .from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['claimed', 'completed']);

  const { count: prCount } = await service
    .from('pull_requests')
    .select('id', { count: 'exact', head: true })
    .eq('author_user_id', user.id);

  const githubConnected = Boolean(profile?.github_handle);

  const hasClaimedIssue = (claimedCount ?? 0) > 0;

  const hasSubmittedPr = (prCount ?? 0) > 0;

  const showChecklist =
    (profile?.github_total_merges ?? 0) === 0 &&
    !(githubConnected && hasClaimedIssue && hasSubmittedPr);

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 font-mono text-white md:p-10">
      <div className="mx-auto max-w-[1400px]">
        <LevelUpBanner />

        {/* Header */}
        <header className="mb-10 flex flex-col justify-between gap-4 border-b border-[#2d333b] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">
              01 / DASHBOARD
            </div>
            <h1 className="font-serif text-3xl text-white md:text-4xl">
              Welcome back, {githubHandle}.
            </h1>
          </div>
          <SyncButton lastSyncedAt={profile?.github_stats_synced_at ?? null} />
        </header>

        {showChecklist && (
          <OnboardingChecklist
            githubConnected={githubConnected}
            hasClaimedIssue={hasClaimedIssue}
            hasSubmittedPr={hasSubmittedPr}
          />
        )}

        {/* Stats Row */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsRow userId={user.id} profile={profile} />
        </Suspense>

        {/* Three-column layout */}
        <div className="grid grid-cols-1 gap-16 xl:grid-cols-3">
          {/* ── Left Sidebar ── */}
          <div className="space-y-12">
            <Suspense fallback={<ProfileSidebarSkeleton />}>
              <ProfileSidebar githubHandle={githubHandle} xp={xp} level={level} />
            </Suspense>
          </div>

          {/* ── Center Feed ── */}
          <main className="min-w-0 space-y-12">
            {/* Journey progress */}
            <Suspense fallback={<JourneyProgressSkeleton />}>
              <JourneyProgress xp={xp} level={level} />
            </Suspense>

            {/* Recent XP activity */}
            <Suspense fallback={<RecentActivitySkeleton />}>
              <RecentActivity userId={user.id} />
            </Suspense>

            {/* Active issues */}
            <Suspense fallback={<RecsSkeleton />}>
              <ActiveIssuesSection />
            </Suspense>

            {/* GitHub PRs */}
            <Suspense fallback={<PrsSkeleton />}>
              <GitHubPRsWrapper userId={user.id} githubHandle={githubHandle} />
            </Suspense>

            {/* Contribution heatmap */}
            <Suspense fallback={<HeatmapSkeleton />}>
              <HeatmapWrapper userId={user.id} />
            </Suspense>

            {/* Daily challenge */}
            <DailyChallenge />

            {/* Course progression */}
            <CourseProgress />

            {/* Mentees */}
            <Suspense fallback={<MenteesSkeleton />}>
              <MenteesSection userId={user.id} />
            </Suspense>

            {/* Trending Repos */}
            <Suspense fallback={<TrendingReposSkeleton />}>
              <TrendingRepos />
            </Suspense>
          </main>

          {/* ── Right Sidebar ── */}
          <div className="space-y-12">
            <Suspense fallback={<RightSidebarSkeleton />}>
              <RightSidebar />
            </Suspense>

            {/* Leaderboard */}
            <Suspense fallback={<LeaderboardSkeleton />}>
              <LeaderboardSnapshot githubHandle={githubHandle} />
            </Suspense>

            {/* Repository Matches */}
            <Suspense fallback={<RepositoryMatchesSkeleton />}>
              <RepositoryMatches
                userId={user.id}
                primaryLanguage={profile?.primary_language ?? null}
              />
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
    <div className="min-h-screen bg-[#000E12] px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 font-serif text-3xl font-bold">Dashboard not configured</h1>
        <p className="text-gray-400">Auth isn&apos;t wired on this deployment yet.</p>
      </div>
    </div>
  );
}
