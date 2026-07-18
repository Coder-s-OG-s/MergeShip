import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getTimeSaved,
  getRepoAnalyticsBreakdown,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';
import TimeSavedPanel from './time-saved-panel';
import { RepoBreakdownTable } from './repo-breakdown-table';
import RangeTabs from './range-tabs';
import type { AnalyticsRange } from '@/lib/maintainer/time-saved';

export const dynamic = 'force-dynamic';

interface AnalyticsPageProps {
  searchParams: Promise<{
    install?: string;
    range?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolvedSearchParams = await searchParams;
  const sb = await getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">Database not configured.</div>
      </div>
    );
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  if (!(await isUserMaintainer(user.id))) {
    redirect('/dashboard');
  }

  const installsRes = await getMaintainerInstalls();
  const installs: MaintainerInstall[] = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">No installations found.</div>
      </div>
    );
  }

  const activeInstallId =
    resolvedSearchParams.install &&
    installs.find((i) => i.installationId === Number(resolvedSearchParams.install))
      ? Number(resolvedSearchParams.install)
      : installs[0]!.installationId;

  const rawRange = resolvedSearchParams.range;
  const range: AnalyticsRange =
    rawRange === '7d' || rawRange === '30d' || rawRange === '90d' || rawRange === 'all'
      ? rawRange
      : '30d';

  const [timeSavedRes, repoAnalyticsRes] = await Promise.all([
    getTimeSaved(activeInstallId, range),
    getRepoAnalyticsBreakdown(activeInstallId, range),
  ]);

  const timeSaved = isOk(timeSavedRes)
    ? timeSavedRes.data
    : {
        aiFilteringHours: 0,
        chainReviewsHours: 0,
        autoTriageHours: 0,
        totalHours: 0,
        projectedAnnualHours: 0,
      };

  const repoAnalytics = isOk(repoAnalyticsRes) ? repoAnalyticsRes.data : [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <div className="flex items-center gap-4">
            <RangeTabs currentRange={range} />
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TimeSavedPanel breakdown={timeSaved} installationId={activeInstallId} range={range} />
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-[#161b22] p-5">
              <div className="mb-4 text-[10px] uppercase tracking-widest text-zinc-500">
                REPOSITORY BREAKDOWN
              </div>
              <RepoBreakdownTable data={repoAnalytics} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
