import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { getMaintainerInstalls, getPrVolumeTimeSeries } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import PrVolumeChart from './pr-volume-chart';
import type { PrVolumeDataPoint } from '@/app/actions/maintainer';

export const dynamic = 'force-dynamic';

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
] as const;

export default async function MaintainerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ install?: string; range?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sb = await getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
        <p className="text-gray-400">Auth not configured.</p>
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
  const installs = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-3 font-display text-3xl font-bold">No installs</h1>
          <p className="text-zinc-400">
            Install the MergeShip App on a repo your organisation owns to see analytics.
          </p>
        </div>
      </div>
    );
  }

  const activeInstallId =
    resolvedSearchParams.install &&
    installs.find((i) => i.installationId === Number(resolvedSearchParams.install))
      ? Number(resolvedSearchParams.install)
      : installs[0]!.installationId;

  const range =
    (['7d', '30d', '90d', 'all'].includes(resolvedSearchParams.range ?? '')
      ? resolvedSearchParams.range
      : '30d') ?? '30d';

  const prVolumeRes = await getPrVolumeTimeSeries({
    installationId: activeInstallId,
    range,
  });
  const prVolumeData: PrVolumeDataPoint[] = isOk(prVolumeRes) ? prVolumeRes.data : [];

  const activeInstall = installs.find((i) => i.installationId === activeInstallId)!;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/maintainer?install=${activeInstallId}`}
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Dashboard
            </Link>
            <h1 className="font-display text-3xl font-bold">Analytics</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {RANGE_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/maintainer/analytics?install=${activeInstallId}&range=${opt.value}`}
                className={`rounded-lg px-2.5 py-1 ${
                  range === opt.value ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </header>

        <p className="mb-6 text-xs text-zinc-500">
          {activeInstall.accountLogin} · {activeInstall.permissionLevel.replace('_', ' ')}
        </p>

        <PrVolumeChart data={prVolumeData} />
      </div>
    </div>
  );
}
