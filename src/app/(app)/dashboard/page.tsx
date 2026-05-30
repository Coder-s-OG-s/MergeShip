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

  const isNewUser = (profile?.xp ?? 0) === 0 && (profile?.github_total_merges ?? 0) === 0;

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

        {/* Getting Started — shown only to new users with 0 XP and 0 merges */}
        {isNewUser && (
          <div className="mb-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Getting Started</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Welcome! Here&apos;s how to earn your first XP on MergeShip.
            </p>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-400">
                  1
                </span>
                <span>
                  Connect your GitHub account via the{' '}
                  <a href="/settings/profile" className="text-green-400 underline">
                    settings page
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-400">
                  2
                </span>
                <span>
                  Browse and claim an issue from the{' '}
                  <a href="/issues" className="text-green-400 underline">
                    Issues page
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-400">
                  3
                </span>
                <span>Submit a PR and get it merged to earn XP</span>
              </li>
            </ol>
          </div>
        )}

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
