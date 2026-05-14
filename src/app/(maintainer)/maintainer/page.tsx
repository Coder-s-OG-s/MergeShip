import Link from 'next/link';
import { GitMerge, GitPullRequest, UserPlus, Flame } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getMaintainerPrQueue,
  getMaintainerDashboardStats,
  getMaintainerRecentActivity,
  getMaintainerHelpRequests,
  getMaintainerLevelDistribution,
  type MaintainerPrRow,
  type ActivityItem,
  type HelpRequestRow,
  type DashboardStats,
  type LevelDistribution,
} from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

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

function levelBadge(level: number | null): string {
  if (level === null) return 'bg-zinc-800 text-zinc-400';
  if (level === 0) return 'bg-zinc-800 text-zinc-400';
  if (level === 1) return 'bg-blue-900/40 text-blue-300';
  if (level === 2) return 'bg-cyan-900/40 text-cyan-300';
  return 'bg-purple-900/40 text-purple-300';
}

function levelLabel(level: number | null): string {
  if (level === null) return '?';
  return `L${level}`;
}

function VerificationBadge({ row }: { row: MaintainerPrRow }) {
  if (row.mentorVerified) {
    return (
      <span className="rounded bg-[#00d26a]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#00d26a]">
        L{row.mentorReviewerLevel ?? '?'} Verified
      </span>
    );
  }
  return (
    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
      Unverified
    </span>
  );
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  if (type === 'pr_merged') return <GitMerge className="h-3.5 w-3.5 shrink-0 text-purple-400" />;
  if (type === 'contributor_joined')
    return <UserPlus className="h-3.5 w-3.5 shrink-0 text-[#00d26a]" />;
  return <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
}

export default async function MaintainerDashboardPage({
  searchParams,
}: {
  searchParams: { install?: string };
}) {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  if (!isOk(installsRes) || installsRes.data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        No GitHub App installations found.
      </div>
    );
  }

  const installs = installsRes.data;
  const installationId =
    searchParams.install && installs.find((i) => i.installationId === Number(searchParams.install))
      ? Number(searchParams.install)
      : installs[0]!.installationId;

  const [statsRes, queueRes, activityRes, helpRes, distRes] = await Promise.all([
    getMaintainerDashboardStats(installationId),
    getMaintainerPrQueue({ installationId, filters: { state: ['open'] } }),
    getMaintainerRecentActivity(installationId),
    getMaintainerHelpRequests(),
    getMaintainerLevelDistribution(),
  ]);

  const stats: DashboardStats = isOk(statsRes)
    ? statsRes.data
    : { openPrs: 0, mentorVerified: 0, aiFlagged: 0, openIssues: 0, stalePrs: 0 };
  const prRows: MaintainerPrRow[] = isOk(queueRes) ? queueRes.data.rows.slice(0, 5) : [];
  const activity: ActivityItem[] = isOk(activityRes) ? activityRes.data : [];
  const helpRequests: HelpRequestRow[] = isOk(helpRes) ? helpRes.data : [];
  const dist: LevelDistribution = isOk(distRes) ? distRes.data : { l0: 0, l1: 0, l2: 0, l3plus: 0 };

  const totalContribs = dist.l0 + dist.l1 + dist.l2 + dist.l3plus;
  const pct = (n: number) => (totalContribs === 0 ? 0 : Math.round((n / totalContribs) * 100));

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
            Overview &amp; Key Metrics
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/maintainer/issues"
            className="rounded-md border border-[#30363d] px-4 py-2 text-[12px] font-medium tracking-wider text-white transition-colors hover:border-[#8b949e]"
          >
            NEW ISSUE
          </Link>
          <Link
            href="/maintainer/pr-queue"
            className="rounded-md bg-[#00d26a] px-4 py-2 text-[12px] font-bold tracking-wider text-black transition-colors hover:bg-[#00d26a]/80"
          >
            MERGE PR
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-5 gap-4">
        <StatCard label="OPEN PRS" value={stats.openPrs} color="text-white" />
        <StatCard label="MENTOR VERIFIED" value={stats.mentorVerified} color="text-[#58a6ff]" />
        <StatCard label="AI FLAGGED" value={stats.aiFlagged} color="text-[#f85149]" />
        <StatCard label="OPEN ISSUES" value={stats.openIssues} color="text-white" />
        <StatCard label="STALE PRS >7D" value={stats.stalePrs} color="text-white" />
      </div>

      {/* Two-column grid */}
      <div className="mb-6 grid grid-cols-[1.4fr,1fr] gap-6">
        {/* PR Queue */}
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
              PR Queue
            </h2>
            <Link
              href="/maintainer/pr-queue"
              className="text-[11px] text-[#00d26a] hover:underline"
            >
              VIEW ALL →
            </Link>
          </div>
          {prRows.length === 0 ? (
            <p className="text-[12px] text-zinc-600">No open PRs.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#30363d] text-[10px] uppercase tracking-widest text-[#8b949e]">
                  <th className="pb-2 text-left font-medium">PR #</th>
                  <th className="pb-2 text-left font-medium">Title</th>
                  <th className="pb-2 text-left font-medium">Contributor</th>
                  <th className="pb-2 text-left font-medium">Level</th>
                  <th className="pb-2 text-left font-medium">Verification</th>
                  <th className="pb-2 text-left font-medium">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/40">
                {prRows.map((row) => (
                  <tr key={row.id} className="group">
                    <td className="py-2 pr-3 font-mono text-[#8b949e]">#{row.number}</td>
                    <td className="max-w-[140px] py-2 pr-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-white hover:text-[#00d26a]"
                        title={row.title}
                      >
                        {row.title}
                      </a>
                    </td>
                    <td className="py-2 pr-3 text-[#8b949e]">@{row.authorLogin}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${levelBadge(row.authorLevel)}`}
                      >
                        {levelLabel(row.authorLevel)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <VerificationBadge row={row} />
                    </td>
                    <td className="py-2 text-[#8b949e]">{relativeTime(row.githubUpdatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Recent Activity */}
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
              Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-[12px] text-zinc-600">No recent activity.</p>
            ) : (
              <ul className="space-y-3">
                {activity.slice(0, 6).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ActivityIcon type={item.type} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-white">{item.text}</div>
                      <div className="truncate text-[10px] text-[#8b949e]">{item.subtext}</div>
                    </div>
                    <span className="shrink-0 text-[10px] text-[#8b949e]">
                      {relativeTime(item.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Meeting Requests */}
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
              Meeting Requests
            </h2>
            {helpRequests.length === 0 ? (
              <p className="text-[12px] text-zinc-600">No pending requests.</p>
            ) : (
              <ul className="space-y-3">
                {helpRequests.map((req) => (
                  <li key={req.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-white">@{req.handle}</div>
                      <div className="truncate text-[10px] text-[#8b949e]">
                        {req.message.slice(0, 40)}
                        {req.message.length > 40 ? '…' : ''}
                      </div>
                    </div>
                    <button className="shrink-0 rounded border border-[#00d26a] px-2 py-0.5 text-[10px] font-medium text-[#00d26a] transition-colors hover:bg-[#00d26a]/10">
                      SCHEDULE
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Contributor Levels Distribution */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
          Contributor Levels Distribution
        </h2>
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {pct(dist.l0) > 0 && (
            <div
              className="bg-zinc-600"
              style={{ width: `${pct(dist.l0)}%` }}
              title={`L0: ${dist.l0}`}
            />
          )}
          {pct(dist.l1) > 0 && (
            <div
              className="bg-blue-500"
              style={{ width: `${pct(dist.l1)}%` }}
              title={`L1: ${dist.l1}`}
            />
          )}
          {pct(dist.l2) > 0 && (
            <div
              className="bg-cyan-500"
              style={{ width: `${pct(dist.l2)}%` }}
              title={`L2: ${dist.l2}`}
            />
          )}
          {pct(dist.l3plus) > 0 && (
            <div
              className="bg-purple-500"
              style={{ width: `${pct(dist.l3plus)}%` }}
              title={`L3+: ${dist.l3plus}`}
            />
          )}
          {totalContribs === 0 && <div className="w-full bg-zinc-800" />}
        </div>
        <div className="mt-3 flex gap-6 text-[11px]">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="inline-block h-2 w-2 rounded-full bg-zinc-600" />
            L0: {dist.l0}
          </span>
          <span className="flex items-center gap-1.5 text-blue-300">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            L1: {dist.l1}
          </span>
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
            L2: {dist.l2}
          </span>
          <span className="flex items-center gap-1.5 text-purple-300">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
            L3+: {dist.l3plus}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-[#8b949e]">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
