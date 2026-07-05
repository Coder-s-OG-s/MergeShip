import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getMaintainerPrQueue,
  getMaintainerAnalyticsTrends,
  getRepoHealthOverview,
  getStaleIssues,
  getFlaggedAccounts,
  getTopContributors,
  getInstallationSettings,
  getReviewerLoad,
  getNoiseBreakdown,
  getPromotionEligible,
  type FlaggedAccountRow,
  type InstallationSettingsData,
  type RepoHealthRow,
  type StaleIssueRow,
  type ContributorRow,
  type ReviewerLoadRow,
  type NoiseBreakdown,
  type PromotionEligibleRow,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import type { MaintainerPrRow } from '@/lib/maintainer/queue';
import type { MaintainerAnalyticsTrends } from '@/lib/maintainer/analytics';
import { isOk } from '@/lib/result';
import RefreshButton from './refresh-button';
import InviteContributorButton from './invite-contributor-button';
import CiStatusBadge from './ci-status-badge';
import AnalyticsTrends from './analytics-trends';
import { VerifyButton } from '../issues/verify-button';
import ExportCsvButton from './export-csv-button';
import QueueSettings from './queue-settings';
import { ResolveFlagButton } from './resolve-flag-button';

export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<'open' | 'closed' | 'merged', string> = {
  open: 'Open',
  closed: 'Closed',
  merged: 'Merged',
};

export default async function MaintainerPage({
  searchParams,
}: {
  searchParams: Promise<{
    install?: string;
    state?: string;
    verified?: string;
    author?: string;
    ai_flagged?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sb = await getServerSupabase();
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
    resolvedSearchParams.install &&
    installs.find((i) => i.installationId === Number(resolvedSearchParams.install))
      ? Number(resolvedSearchParams.install)
      : installs[0]!.installationId;

  const activeInstall = installs.find((i) => i.installationId === activeInstallId)!;

  const filters: {
    state?: ('open' | 'closed' | 'merged')[];
    mentorVerified?: 'yes' | 'no';
    authorLogin?: string;
    aiFlagged?: 'yes' | 'no';
  } = {};
  if (resolvedSearchParams.state) {
    const parts = resolvedSearchParams.state
      .split(',')
      .filter((s) => ['open', 'closed', 'merged'].includes(s)) as ('open' | 'closed' | 'merged')[];
    if (parts.length > 0) filters.state = parts;
  }
  if (resolvedSearchParams.verified === 'yes' || resolvedSearchParams.verified === 'no') {
    filters.mentorVerified = resolvedSearchParams.verified;
  }
  if (resolvedSearchParams.ai_flagged === 'yes' || resolvedSearchParams.ai_flagged === 'no') {
    filters.aiFlagged = resolvedSearchParams.ai_flagged;
  }
  if (!filters.state) filters.state = ['open']; // default
  if (resolvedSearchParams.author) {
    filters.authorLogin = resolvedSearchParams.author;
  }
  const queueRes = await getMaintainerPrQueue({
    installationId: activeInstallId,
    filters,
  });
  const rows: MaintainerPrRow[] = isOk(queueRes) ? queueRes.data.rows : [];
  const trendsRes = await getMaintainerAnalyticsTrends({ installationId: activeInstallId });
  const analyticsTrends: MaintainerAnalyticsTrends = isOk(trendsRes)
    ? trendsRes.data
    : { weekly: [], levelDistribution: [], avgReviewTimeHours: null };
  const repoHealthRes = await getRepoHealthOverview({ installationId: activeInstallId });
  const repoHealthRows: RepoHealthRow[] = isOk(repoHealthRes) ? repoHealthRes.data : [];

  const staleIssuesRes = await getStaleIssues({ installationId: activeInstallId });
  const staleIssues: StaleIssueRow[] = isOk(staleIssuesRes) ? staleIssuesRes.data : [];

  const contributorsRes = await getTopContributors({ installationId: activeInstallId });
  const topContributors: ContributorRow[] = isOk(contributorsRes) ? contributorsRes.data : [];
  const flaggedAccountsRes = await getFlaggedAccounts({ installationId: activeInstallId });
  const flaggedAccounts: FlaggedAccountRow[] = isOk(flaggedAccountsRes)
    ? flaggedAccountsRes.data
    : [];
  const settingsRes = await getInstallationSettings(activeInstallId);
  const settings: InstallationSettingsData = isOk(settingsRes)
    ? settingsRes.data
    : {
        installationId: activeInstallId,
        minContributorLevel: 0,
        autoAssignMentorChain: false,
        aiPrDetection: false,
      };

  const reviewerLoadsRes = await getReviewerLoad({ installationId: activeInstallId });
  const reviewerLoads: ReviewerLoadRow[] = isOk(reviewerLoadsRes) ? reviewerLoadsRes.data : [];
  const maxLoad = reviewerLoads.length > 0 ? Math.max(...reviewerLoads.map((r) => r.prCount)) : 0;

  let noise: NoiseBreakdown = { valid: 0, spamAi: 0, other: 0, total: 0 };
  if (settings.aiPrDetection) {
    const noiseRes = await getNoiseBreakdown({ installationId: activeInstallId });
    if (isOk(noiseRes)) {
      noise = noiseRes.data;
    }
  }

  const promotionEligibleRes = await getPromotionEligible({ installationId: activeInstallId });
  const promotionEligible: PromotionEligibleRow[] = isOk(promotionEligibleRes)
    ? promotionEligibleRes.data
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Maintainer</h1>
          <div className="flex items-center gap-2">
            <InviteContributorButton
              installationId={activeInstallId}
              accountLogin={activeInstall.accountLogin}
            />
            <Link
              href={`/maintainer?install=${activeInstallId}&state=open`}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600"
            >
              View PR Queue →
            </Link>
            <RefreshButton installationId={activeInstallId} />
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <FilterPill
            label="Open"
            href={withParam('state', 'open', resolvedSearchParams)}
            active={filters.state?.includes('open') ?? false}
          />
          <FilterPill
            label="Merged"
            href={withParam('state', 'merged', resolvedSearchParams)}
            active={filters.state?.includes('merged') ?? false}
          />
          <FilterPill
            label="Closed"
            href={withParam('state', 'closed', resolvedSearchParams)}
            active={filters.state?.includes('closed') ?? false}
          />
          <span className="mx-2 text-zinc-700">|</span>
          <FilterPill
            label="Verified ✓"
            href={withParam('verified', 'yes', resolvedSearchParams)}
            active={resolvedSearchParams.verified === 'yes'}
          />
          <FilterPill
            label="Unverified"
            href={withParam('verified', 'no', resolvedSearchParams)}
            active={resolvedSearchParams.verified === 'no'}
          />
          <FilterPill
            label="All"
            href={withParam('verified', '', resolvedSearchParams)}
            active={!resolvedSearchParams.verified}
          />
          <div className="ml-auto flex items-center gap-2">
            <ExportCsvButton installationId={activeInstallId} filters={filters} />
            <Link
              href={`/maintainer/issues?install=${activeInstallId}`}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-600"
            >
              Issue triage →
            </Link>
          </div>
          {settings.aiPrDetection && (
            <>
              <span className="mx-2 text-zinc-700">|</span>
              <FilterPill
                label="⚠ AI Flagged"
                href={withParam(
                  'ai_flagged',
                  resolvedSearchParams.ai_flagged === 'yes' ? '' : 'yes',
                  resolvedSearchParams,
                )}
                active={resolvedSearchParams.ai_flagged === 'yes'}
              />
            </>
          )}
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
        <QueueSettings settings={settings} />
        <AnalyticsTrends data={analyticsTrends} />
        {promotionEligible.length > 0 && (
          <section className="mb-8 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-emerald-100">Promotion Eligible</h2>
                <p className="mt-1 text-xs text-emerald-200/70">
                  These contributors are within 10% of their next level.
                </p>
              </div>
              <span className="rounded-full bg-emerald-900/50 px-2 py-1 text-xs text-emerald-100">
                {promotionEligible.length} contributor{promotionEligible.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {promotionEligible.map((c) => (
                <div key={c.githubHandle} className="rounded-lg border border-emerald-900/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-emerald-50">@{c.githubHandle}</p>
                      <p className="mt-1 text-xs text-emerald-200/70">
                        L{c.level} · {c.xp.toLocaleString()} XP
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-emerald-200/50">
                        {c.xpNeeded} XP to L{c.level + 1}
                      </span>
                      <Link
                        href={`/@${c.githubHandle}`}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Review profile →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {flaggedAccounts.length > 0 && (
          <section className="mb-8 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-amber-100">Suspicious XP Signals</h2>
                <p className="mt-1 text-xs text-amber-200/70">
                  Daily detector output for maintainer review.
                </p>
              </div>
              <span className="rounded-full bg-amber-900/50 px-2 py-1 text-xs text-amber-100">
                {flaggedAccounts.length} open
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {flaggedAccounts.map((flag) => (
                <div key={flag.id} className="rounded-lg border border-amber-900/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-amber-50">@{flag.githubHandle}</p>
                      <p className="mt-1 text-xs text-amber-200/70">
                        Level {flag.level} · {flag.xp} XP
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        flag.severity === 'high'
                          ? 'bg-red-900/50 text-red-200'
                          : 'bg-amber-900/50 text-amber-100'
                      }`}
                    >
                      {flag.severity}
                    </span>
                    <ResolveFlagButton flagId={flag.id} installationId={activeInstallId} />
                  </div>
                  <p className="mt-3 text-sm text-amber-100">{formatFlagReason(flag.reason)}</p>
                  <p className="mt-1 text-xs text-amber-200/70">{flag.summary}</p>
                  <p className="mt-2 text-xs text-amber-200/50">
                    Detected {relativeTime(flag.detectedAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <section className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div>
              <h2 className="mb-4 text-sm font-semibold text-white">Average Review Time</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">
                  {analyticsTrends.avgReviewTimeHours !== null
                    ? `${analyticsTrends.avgReviewTimeHours.toFixed(1)}h`
                    : '—'}
                </span>
                {analyticsTrends.avgReviewTimeHours !== null && (
                  <span className="text-xs text-zinc-500">elapsed hours</span>
                )}
              </div>
            </div>
            <div className="mt-4 border-t border-zinc-800/60 pt-3">
              <p className="text-[11px] text-zinc-500">
                Average duration from PR open to mentor verification for this installation.
              </p>
            </div>
          </section>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Repository Health</h2>

            <div className="space-y-3">
              {repoHealthRows.map((repo) => (
                <div key={repo.repoFullName} className="rounded-lg border border-zinc-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-200">{repo.repoFullName}</span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        repo.repoHealthScore >= 80
                          ? 'bg-emerald-900/40 text-emerald-300'
                          : repo.repoHealthScore >= 50
                            ? 'bg-yellow-900/40 text-yellow-300'
                            : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      {repo.repoHealthScore}%
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">
                    Updated {relativeTime(repo.updatedAt ?? new Date().toISOString())}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Stale Issues</h2>

            <div className="space-y-3">
              {staleIssues.map((issue) => (
                <div key={issue.id} className="rounded-lg border border-zinc-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-200">{issue.title}</span>

                    <span className="text-xs text-red-400">{issue.daysStale}d stale</span>
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">{issue.repoFullName}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Top Contributors</h2>

            <div className="space-y-3">
              {topContributors.map((contributor) => (
                <div
                  key={contributor.githubHandle}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
                >
                  <div>
                    <p className="text-sm text-zinc-200">@{contributor.githubHandle}</p>

                    <p className="text-xs text-zinc-500">Level {contributor.level}</p>
                  </div>

                  <span className="text-sm text-emerald-400">{contributor.xp} XP</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Reviewer Load</h2>

            <div className="space-y-3">
              {reviewerLoads.length === 0 ? (
                <p className="text-xs text-zinc-500">No active reviewer load.</p>
              ) : (
                reviewerLoads.map((rev) => {
                  const percentage = maxLoad > 0 ? (rev.prCount / maxLoad) * 100 : 0;
                  return (
                    <div key={rev.reviewerId} className="rounded-lg border border-zinc-800 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-zinc-200">@{rev.githubHandle}</span>
                        <span className="text-xs text-zinc-400">{rev.prCount} PRs</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {settings.aiPrDetection && (
          <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">PR Noise Breakdown</h2>
            <NoiseDonut noise={noise} />
          </section>
        )}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <CiStatusBadge
                      installationId={activeInstallId}
                      repoFullName={r.repoFullName}
                      prNumber={r.number}
                    />
                    <Link
                      href={`/maintainer/pr/${r.id}?install=${activeInstallId}`}
                      className="font-display text-base font-semibold text-white hover:underline"
                    >
                      {r.title}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {r.repoFullName} · #{r.number}
                    </span>
                    {r.draft && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        Draft
                      </span>
                    )}
                    {r.aiFlagged && (
                      <span className="rounded-full bg-rose-900/40 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-rose-700/40">
                        AI Flagged
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
                {r.mentorVerified ? (
                  <span className="shrink-0 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
                    ✓ Mentor verified
                    {r.mentorReviewerHandle && (
                      <span className="ml-1 text-emerald-400/80">
                        by @{r.mentorReviewerHandle}
                        {r.mentorReviewerLevel !== null && ` (L${r.mentorReviewerLevel})`}
                      </span>
                    )}
                  </span>
                ) : (
                  r.authorUserId !== user.id &&
                  r.state === 'open' && (
                    <div className="shrink-0">
                      <VerifyButton prId={r.id} />
                    </div>
                  )
                )}
                <Link
                  href={`/maintainer/pr/${r.id}`}
                  className="shrink-0 text-sm text-zinc-400 hover:text-white"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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

function NoiseDonut({ noise }: { noise: NoiseBreakdown }) {
  const { valid, spamAi, other, total } = noise;
  const R = 40;
  const C = 2 * Math.PI * R; // circumference ≈ 251.3

  // Guard against zero-total to avoid divide-by-zero
  const safePct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  // Each segment: offset advances by the previous segment's dash length
  type Seg = { color: string; pct: number; label: string };
  const segments: Seg[] = [
    { color: '#10b981', pct: safePct(valid), label: 'Valid' }, // emerald-500
    { color: '#f43f5e', pct: safePct(spamAi), label: 'Spam/AI' }, // rose-500
    { color: '#52525b', pct: safePct(other), label: 'Other' }, // zinc-600
  ];

  let offsetPct = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.pct / 100) * C;
    const offset = (offsetPct / 100) * C;
    offsetPct += seg.pct;
    return { ...seg, dash, offset };
  });

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        {total === 0 ? (
          <circle cx="50" cy="50" r={R} fill="none" stroke="#3f3f46" strokeWidth="14" />
        ) : (
          arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth="14"
              strokeDasharray={`${arc.dash} ${C - arc.dash}`}
              strokeDashoffset={-arc.offset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          ))
        )}
        <text x="50" y="54" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">
          {total}
        </text>
      </svg>

      <div className="space-y-2 text-sm">
        {total === 0 ? (
          <p className="text-xs text-zinc-500">
            No data yet. Classification runs as new PRs arrive.
          </p>
        ) : (
          segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="text-zinc-300">{seg.label}</span>
              <span className="ml-auto pl-4 tabular-nums text-zinc-400">{seg.pct.toFixed(0)}%</span>
            </div>
          ))
        )}
      </div>
    </div>
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

function formatFlagReason(reason: string) {
  const labels: Record<string, string> = {
    daily_xp_event_spike: 'Daily XP event spike',
    rapid_merge_spike: 'Rapid merge spike',
    reviewer_approval_concentration: 'Reviewer approval concentration',
  };

  return labels[reason] ?? 'Suspicious activity';
}

function NotConfigured() {
  return (
    <div className="min-h-screen px-6 py-20 text-white">
      <p className="text-gray-400">Auth not configured.</p>
    </div>
  );
}
