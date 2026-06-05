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

  return (
    <div className="app-page mx-auto max-w-6xl">
      <LevelUpBanner />
      <header className="app-page-header">
        <div>
          <p className="app-eyebrow">01 / Dashboard</p>
          <h1 className="app-title">Welcome back, {profile?.github_handle ?? 'Contributor'}.</h1>
        </div>
        <div className="flex shrink-0 items-center gap-4">
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
