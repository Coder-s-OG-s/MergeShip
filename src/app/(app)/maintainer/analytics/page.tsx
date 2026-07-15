import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { getMaintainerInstalls, getTimeSaved } from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';
import TimeSavedPanel from './time-saved-panel';
import Link from 'next/link';
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
    rawRange === '30d' || rawRange === '90d' || rawRange === 'all' ? rawRange : '30d';

  const timeSavedRes = await getTimeSaved(activeInstallId, range);
  const timeSaved = isOk(timeSavedRes)
    ? timeSavedRes.data
    : {
        aiFilteringHours: 0,
        chainReviewsHours: 0,
        autoTriageHours: 0,
        totalHours: 0,
        projectedAnnualHours: 0,
      };

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 text-xs">
              {(['30d', '90d', 'all'] as const).map((r) => {
                const active = range === r;
                return (
                  <Link
                    key={r}
                    href={`/maintainer/analytics?install=${activeInstallId}&range=${r}`}
                    className={`rounded px-2.5 py-1.5 transition-colors ${
                      active
                        ? 'bg-emerald-500 font-semibold text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <TimeSavedPanel breakdown={timeSaved} installationId={activeInstallId} range={range} />
        </div>
      </div>
    </div>
  );
}
