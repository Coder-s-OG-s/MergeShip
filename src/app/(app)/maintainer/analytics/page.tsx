import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getQueueSignalQuality,
  getTimeSaved,
  getRepoAnalyticsBreakdown,
  getAnalyticsStats,
  getPrVolumeTimeSeries,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';
import TimeSavedPanel from './time-saved-panel';
import { RepoBreakdownTable } from './repo-breakdown-table';
import RangeTabs from './range-tabs';
import QueueSignalPanel from './queue-signal-panel';
import { StatsHeader } from './stats-header';
import SummaryBanner from './summary-banner';
import PrVolumeChart from './pr-volume-chart';
import type { PrVolumeDataPoint } from '@/app/actions/maintainer';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';

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

  const [timeSavedRes, repoAnalyticsRes, queueSignalRes, statsRes, prVolumeRes] = await Promise.all(
    [
      getTimeSaved(activeInstallId, range),
      getRepoAnalyticsBreakdown(activeInstallId, range),
      getQueueSignalQuality(activeInstallId, range),
      getAnalyticsStats(activeInstallId, range),
      getPrVolumeTimeSeries({ installationId: activeInstallId, range }),
    ],
  );

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
  const queueSignalQuality = isOk(queueSignalRes)
    ? queueSignalRes.data
    : {
        signalRate: 0,
        mergedAsIs: 0,
        mergedWithEdits: 0,
        closedRejected: 0,
        total: 0,
      };

  const stats = isOk(statsRes)
    ? statsRes.data
    : {
        prsMerged: { value: 0, delta: 0, deltaPositiveIsGood: true },
        avgReviewTimeHours: { value: 0, delta: 0, deltaPositiveIsGood: false },
        queueSignalRate: { value: 0, delta: 0, deltaPositiveIsGood: true },
        aiPrsBlocked: { value: 0, delta: 0, deltaPositiveIsGood: true },
        contributorsLeveledUp: { value: 0, delta: 0, deltaPositiveIsGood: true },
        maintainerTimeSavedHours: { value: 0, delta: 0, deltaPositiveIsGood: true },
      };

  const prVolumeData: PrVolumeDataPoint[] = isOk(prVolumeRes) ? prVolumeRes.data : [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <div className="flex items-center gap-4">
            <RangeTabs currentRange={range} />
          </div>
        </header>

        <StatsHeader stats={stats} />

        <div className="mb-8">
          <PrVolumeChart data={prVolumeData} />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TimeSavedPanel breakdown={timeSaved} installationId={activeInstallId} range={range} />
          </div>
          <div className="lg:col-span-1">
            <QueueSignalPanel data={queueSignalQuality} />
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

        <SummaryBanner stats={stats} range={range} installationId={activeInstallId} />
      </div>
    </div>
  );
}
