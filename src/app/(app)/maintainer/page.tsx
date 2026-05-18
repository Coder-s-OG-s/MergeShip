import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerAnalytics,
  getMaintainerInstalls,
  getMaintainerPrQueue,
  type MaintainerInstall,
  type MaintainerPrRow,
} from '@/app/actions/maintainer';
import type { MaintainerAnalytics } from '@/lib/maintainer/analytics';
import { isOk } from '@/lib/result';
import RefreshButton from './refresh-button';

export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<'open' | 'closed' | 'merged', string> = {
  open: 'Open',
  closed: 'Closed',
  merged: 'Merged',
};

export default async function MaintainerPage({
  searchParams,
}: {
  searchParams: { install?: string; state?: string; verified?: string };
}) {
  const sb = getServerSupabase();
  if (!sb) {
    return <NotConfigured />;
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
    return <NoInstalls />;
  }

  const activeInstallId =
    searchParams.install && installs.find((i) => i.installationId === Number(searchParams.install))
      ? Number(searchParams.install)
      : installs[0]!.installationId;

  const activeInstall = installs.find((i) => i.installationId === activeInstallId)!;

  const filters: { state?: ('open' | 'closed' | 'merged')[]; mentorVerified?: 'yes' | 'no' } = {};
  if (searchParams.state) {
    const parts = searchParams.state
      .split(',')
      .filter((s) => ['open', 'closed', 'merged'].includes(s)) as ('open' | 'closed' | 'merged')[];
    if (parts.length > 0) filters.state = parts;
  }
  if (searchParams.verified === 'yes' || searchParams.verified === 'no') {
    filters.mentorVerified = searchParams.verified;
  }
  if (!filters.state) filters.state = ['open']; // default

  const queueRes = await getMaintainerPrQueue({
    installationId: activeInstallId,
    filters,
  });
  const rows: MaintainerPrRow[] = isOk(queueRes) ? queueRes.data.rows : [];
  const analyticsRes = await getMaintainerAnalytics({ installationId: activeInstallId });
  const analytics: MaintainerAnalytics | null = isOk(analyticsRes) ? analyticsRes.data : null;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Maintainer</h1>
          <RefreshButton installationId={activeInstallId} />
        </header>

        {installs.length > 1 && (
          <nav className="mb-6 flex flex-wrap gap-2 text-sm">
            {installs.map((i) => (
              <Link
                key={i.installationId}
                href={`/maintainer?install=${i.installationId}`}
                className={`rounded-lg px-3 py-1 ${
                  i.installationId === activeInstallId
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {i.accountLogin}
                <span className="ml-1.5 text-xs text-zinc-500">{i.accountType[0]}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <FilterPill
            label="Open"
            href={withParam('state', 'open', searchParams)}
            active={filters.state?.includes('open') ?? false}
          />
          <FilterPill
            label="Merged"
            href={withParam('state', 'merged', searchParams)}
            active={filters.state?.includes('merged') ?? false}
          />
          <FilterPill
            label="Closed"
            href={withParam('state', 'closed', searchParams)}
            active={filters.state?.includes('closed') ?? false}
          />
          <span className="mx-2 text-zinc-700">|</span>
          <FilterPill
            label="Verified ✓"
            href={withParam('verified', 'yes', searchParams)}
            active={searchParams.verified === 'yes'}
          />
          <FilterPill
            label="Unverified"
            href={withParam('verified', 'no', searchParams)}
            active={searchParams.verified === 'no'}
          />
          <FilterPill
            label="All"
            href={withParam('verified', '', searchParams)}
            active={!searchParams.verified}
          />
          <Link
            href={`/maintainer/issues?install=${activeInstallId}`}
            className="ml-auto rounded-lg border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-600"
          >
            Issue triage →
          </Link>
          <Link
            href={`/maintainer/community?install=${activeInstallId}`}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-600"
          >
            Community links →
          </Link>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          {activeInstall.accountLogin} ({activeInstall.permissionLevel.replace('_', ' ')})
        </p>

        {analytics && <AnalyticsPanel analytics={analytics} installationId={activeInstallId} />}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            No PRs match your filters. Try widening state or running a refresh.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-display text-base font-semibold text-white hover:underline"
                    >
                      {r.title}
                    </a>
                    <span className="text-xs text-zinc-500">
                      {r.repoFullName} · #{r.number}
                    </span>
                    {r.draft && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        Draft
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${stateColor(r.state)}`}>
                      {TIER_LABEL[r.state]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span>@{r.authorLogin}</span>
                    <AuthorBadge level={r.authorLevel} xp={r.authorXp} merged={r.authorMergedPrs} />
                    <span className="text-zinc-600">·</span>
                    <span>{relativeTime(r.githubUpdatedAt)}</span>
                  </div>
                </div>
                {r.mentorVerified && (
                  <span className="shrink-0 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
                    ✓ Mentor verified
                    {r.mentorReviewerHandle && (
                      <span className="ml-1 text-emerald-400/80">
                        by @{r.mentorReviewerHandle}
                        {r.mentorReviewerLevel !== null && ` (L${r.mentorReviewerLevel})`}
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AnalyticsPanel({
  analytics,
  installationId,
}: {
  analytics: MaintainerAnalytics;
  installationId: number;
}) {
  const maxMerged = Math.max(1, ...analytics.weekly.map((point) => point.mergedPrs));
  const maxXp = Math.max(1, ...analytics.weekly.map((point) => point.xpDistributed));

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Analytics trends</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cached for 30 minutes · generated {relativeTime(analytics.generatedAt)}
          </p>
        </div>
        <Link
          href={`/maintainer/issues?install=${installationId}`}
          className="hidden rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 sm:inline-flex"
        >
          Review issue health →
        </Link>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Merged PRs / 12w" value={analytics.totals.mergedPrs12w} />
        <MetricCard label="Avg merge rate" value={`${analytics.totals.mergeRatePerWeek}/wk`} />
        <MetricCard
          label="XP distributed"
          value={analytics.totals.xpDistributed12w.toLocaleString()}
        />
        <MetricCard label="Active contributors" value={analytics.totals.activeContributors12w} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Weekly merge rate</h3>
            <span className="text-xs text-zinc-500">last 12 weeks</span>
          </div>
          <div className="flex h-40 items-end gap-2">
            {analytics.weekly.map((point) => (
              <div key={point.start} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t bg-emerald-400/80"
                  style={{ height: `${Math.max(4, (point.mergedPrs / maxMerged) * 100)}%` }}
                  title={`${point.label}: ${point.mergedPrs} merged PRs`}
                />
                <span className="max-w-full truncate text-[10px] text-zinc-600">{point.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">XP distributed per week</h3>
            <span className="text-xs text-zinc-500">completed recommendations</span>
          </div>
          <div className="flex h-40 items-end gap-2">
            {analytics.weekly.map((point) => (
              <div key={point.start} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t bg-sky-400/80"
                  style={{ height: `${Math.max(4, (point.xpDistributed / maxXp) * 100)}%` }}
                  title={`${point.label}: ${point.xpDistributed} XP`}
                />
                <span className="max-w-full truncate text-[10px] text-zinc-600">{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Contributor level distribution</h3>
          <span className="text-xs text-zinc-500">monthly cohort view</span>
        </div>
        <div className="space-y-3">
          {analytics.levelDistribution.map((point) => (
            <StackedLevelRow key={point.monthStart} point={point} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function StackedLevelRow({ point }: { point: MaintainerAnalytics['levelDistribution'][number] }) {
  const total = point.l0 + point.l1 + point.l2 + point.l3Plus;
  const segments = [
    { label: 'L0', value: point.l0, color: 'bg-zinc-600' },
    { label: 'L1', value: point.l1, color: 'bg-emerald-500' },
    { label: 'L2', value: point.l2, color: 'bg-sky-500' },
    { label: 'L3+', value: point.l3Plus, color: 'bg-purple-500' },
  ];

  return (
    <div className="grid grid-cols-[3rem_1fr_5rem] items-center gap-3 text-xs">
      <span className="text-zinc-500">{point.label}</span>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.color}
            style={{ width: `${total > 0 ? (segment.value / total) * 100 : 0}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <span className="text-right text-zinc-500">{total} users</span>
    </div>
  );
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-2.5 py-1 ${
        active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

function AuthorBadge({
  level,
  xp,
  merged,
}: {
  level: number | null;
  xp: number | null;
  merged: number | null;
}) {
  if (level === null) {
    return <span className="text-zinc-600">not on MergeShip</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-500">
      <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-zinc-300">L{level}</span>
      {xp !== null && <span>{xp.toLocaleString()} XP</span>}
      {merged !== null && merged > 0 && <span>· {merged} merged</span>}
    </span>
  );
}

function stateColor(state: 'open' | 'closed' | 'merged'): string {
  if (state === 'open') return 'bg-emerald-900/40 text-emerald-300';
  if (state === 'merged') return 'bg-purple-900/40 text-purple-300';
  return 'bg-zinc-800 text-zinc-400';
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function withParam(
  key: string,
  value: string,
  current: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v && k !== key) params.set(k, v);
  }
  if (value) params.set(key, value);
  return `/maintainer?${params.toString()}`;
}

function NoInstalls() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-3 font-display text-3xl font-bold">No installs</h1>
        <p className="text-zinc-400">
          Install the MergeShip App on a repo your organisation owns to see PRs here.
        </p>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="min-h-screen px-6 py-20 text-white">
      <p className="text-gray-400">Auth not configured.</p>
    </div>
  );
}
