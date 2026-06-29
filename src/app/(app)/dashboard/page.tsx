import { Suspense } from 'react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import LevelUpBanner from './level-up-banner';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell } from 'lucide-react';

// New Extracted Components
import { AnnouncementsCard, AnnouncementsSkeleton } from './announcements-card';
import { SyncButton } from './sync-button';
import { MentorCard, MentorSkeleton } from './mentor-card';

// Existing dashboard components
import {
  TotalMergesCard,
  TotalMergesSkeleton,
  MentorPointsCard,
  MentorPointsSkeleton,
  CurrentStreakCard,
  CurrentStreakSkeleton,
} from './stats-row';
import ActiveIssuesSection, { RecsSkeleton } from './active-issues';
import GitHubPRsWrapper, { PrsSkeleton } from './github-prs-wrapper';
import LeaderboardSnapshot, { LeaderboardSkeleton } from './leaderboard-snapshot';
import MenteesSection, { MenteesSkeleton } from './mentees-section';
import TrendingRepos, { TrendingReposSkeleton } from './trending-repos';
import RepositoryMatches, { RepositoryMatchesSkeleton } from './repository-matches';

// contributor-dashboard components
import {
  ProfileIdentityCard,
  ProfileIdentitySkeleton,
  ProfileXpCard,
  ProfileXpSkeleton,
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
  const streak = profile?.github_streak ?? 0;

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 font-mono text-white md:p-10">
      <div className="mx-auto max-w-[1400px]">
        <LevelUpBanner />

        {/* Header */}
        <header className="mb-6 flex flex-col justify-between gap-4 pb-2 md:flex-row md:items-end">
          <div>
            <h1 className="font-serif text-3xl text-white md:text-4xl">
              Welcome back, {githubHandle}.
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">LEVEL</div>
              <div className="font-serif text-2xl font-bold text-white">L{level}</div>
            </div>
            <SyncButton lastSyncedAt={profile?.github_stats_synced_at ?? null} />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-[#161b22]">
              <Bell className="h-4 w-4 text-zinc-400" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </div>
          </div>
        </header>

        {/* Profile Stats Row */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-5">
          <Suspense fallback={<ProfileIdentitySkeleton />}>
            <ProfileIdentityCard githubHandle={githubHandle} level={level} trustScore={0} />
          </Suspense>
          <Suspense fallback={<ProfileXpSkeleton />}>
            <ProfileXpCard xp={xp} />
          </Suspense>
          <Suspense fallback={<TotalMergesSkeleton />}>
            <TotalMergesCard userId={user.id} profile={profile} />
          </Suspense>
          <Suspense fallback={<MentorPointsSkeleton />}>
            <MentorPointsCard userId={user.id} />
          </Suspense>
          <Suspense fallback={<CurrentStreakSkeleton />}>
            <CurrentStreakCard userId={user.id} profile={profile} />
          </Suspense>
        </div>

        {/* Journey Progress Bar (Full Width) */}
        <div className="mb-10 border-b border-[#2d333b] pb-10">
          <Suspense fallback={<JourneyProgressSkeleton />}>
            <JourneyProgress xp={xp} level={level} />
          </Suspense>
        </div>

        {/* Main Grid Layout */}
        <main className="space-y-6">
          {/* Row 1 (Formerly Row 2) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Suspense fallback={<HeatmapSkeleton />}>
                <HeatmapWrapper userId={user.id} />
              </Suspense>
            </div>
            <div className="lg:col-span-1">
              <DailyChallenge />
            </div>
          </div>

          {/* Row 2 (Formerly Row 1) */}
          <div className="grid grid-cols-1 gap-6 lg:h-[420px] lg:grid-cols-3">
            <div className="h-[400px] min-h-0 lg:col-span-1 lg:h-full">
              <Suspense fallback={<RecentActivitySkeleton />}>
                <RecentActivity userId={user.id} />
              </Suspense>
            </div>
            <div className="flex h-full min-h-0 flex-col gap-6 lg:col-span-1">
              <Suspense fallback={<AnnouncementsSkeleton />}>
                <AnnouncementsCard />
              </Suspense>
            </div>
            <div className="h-[400px] min-h-0 lg:col-span-1 lg:h-full">
              <Suspense fallback={<LeaderboardSkeleton />}>
                <LeaderboardSnapshot githubHandle={githubHandle} />
              </Suspense>
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-[400px]">
              <Suspense
                fallback={
                  <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
                }
              >
                <CourseProgress userId={user.id} />
              </Suspense>
            </div>
            <div className="h-[400px]">
              <Suspense fallback={<MentorSkeleton />}>
                <MentorCard />
              </Suspense>
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-[400px]">
              <Suspense fallback={<TrendingReposSkeleton />}>
                <TrendingRepos />
              </Suspense>
            </div>
            <div className="h-[400px]">
              <Suspense fallback={<RepositoryMatchesSkeleton />}>
                <RepositoryMatches
                  userId={user.id}
                  primaryLanguage={profile?.primary_language ?? null}
                />
              </Suspense>
            </div>
          </div>

          {/* Additional Features (Directly Rendered) */}
          <div className="mt-12 grid grid-cols-1 gap-6 border-t border-[#2d333b] pt-12 lg:grid-cols-3">
            <div className="h-[500px] lg:col-span-1">
              <Suspense fallback={<MenteesSkeleton />}>
                <MenteesSection userId={user.id} />
              </Suspense>
            </div>

            <div className="h-[500px] lg:col-span-1">
              <Suspense fallback={<RecsSkeleton />}>
                <ActiveIssuesSection />
              </Suspense>
            </div>

            <div className="h-[500px] lg:col-span-1">
              <Suspense fallback={<PrsSkeleton />}>
                <GitHubPRsWrapper userId={user.id} githubHandle={githubHandle} />
              </Suspense>
            </div>
          </div>
          {/* Horizontal Quick Links */}
          <div className="mt-8 border-t border-[#2d333b] pt-6">
            <h2 className="mb-4 text-center text-[10px] uppercase tracking-widest text-zinc-500">
              QUICK LINKS
            </h2>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              {[
                { label: 'MY PULL REQUESTS', href: '/my-prs' },
                { label: 'BROWSE ISSUES', href: '/issues' },
                { label: 'LEADERBOARD', href: '/leaderboard' },
                { label: 'SETTINGS', href: '/settings/profile' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center text-[11px] font-bold uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
                >
                  {link.label}
                  <span className="ml-2 text-zinc-700">→</span>
                </Link>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 flex justify-between border-t border-[#2d333b] pt-6 text-[10px] uppercase tracking-widest text-zinc-600">
          <span>©{new Date().getFullYear()} ARCH_06 / SYSTEM_v1.0</span>
          <div className="flex gap-6">
            <Link href="/terms" className="transition-colors hover:text-zinc-400">
              TERMS
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-zinc-400">
              PRIVACY
            </Link>
            <Link href="/security" className="transition-colors hover:text-zinc-400">
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
