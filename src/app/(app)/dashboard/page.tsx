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
    .select('github_handle, xp, level, github_total_merges, github_streak, github_stats_synced_at')
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const githubHandle = profile?.github_handle ?? 'Contributor';

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

        {/* Stats Row */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsRow userId={user.id} profile={profile} />
        </Suspense>

      {/* Stats Row */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsRow userId={user.id} profile={profile} />
      </Suspense>

      {/* Main Columns */}
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        {/* Left Column */}
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

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} MergeShip</span>
        <div className="flex gap-6">
          <Link href="#">Terms</Link>
          <Link href="#">Privacy</Link>
          <Link href="#">Security</Link>
        </div>
      </footer>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="app-page">
      <div className="mx-auto max-w-xl">
        <h1 className="app-title-sm mb-4">Dashboard not configured</h1>
        <p className="app-body">Auth isn&apos;t wired on this deployment yet.</p>
      </div>
    </div>
  );
}
