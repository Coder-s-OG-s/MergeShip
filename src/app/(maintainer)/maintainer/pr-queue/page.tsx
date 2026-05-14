import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getMaintainerPrQueue,
  type MaintainerPrRow,
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
  if (level === null || level === 0) return 'bg-zinc-800 text-zinc-400';
  if (level === 1) return 'bg-blue-900/40 text-blue-300';
  if (level === 2) return 'bg-cyan-900/40 text-cyan-300';
  return 'bg-purple-900/40 text-purple-300';
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1.5 text-[11px] font-medium tracking-wider transition-colors ${
        active
          ? 'border border-[#00d26a]/30 bg-[#00d26a]/10 text-[#00d26a]'
          : 'border border-[#30363d] text-[#8b949e] hover:border-[#8b949e] hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
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

function buildHref(
  current: Record<string, string | undefined>,
  updates: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...updates })) {
    if (v) params.set(k, v);
  }
  return `/maintainer/pr-queue?${params.toString()}`;
}

export default async function PrQueuePage({
  searchParams,
}: {
  searchParams: { install?: string; state?: string; verified?: string; page?: string };
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

  const page = Math.max(0, Number(searchParams.page ?? 0));

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
  if (!filters.state) filters.state = ['open'];

  const queueRes = await getMaintainerPrQueue({ installationId, filters, page });
  const rows: MaintainerPrRow[] = isOk(queueRes) ? queueRes.data.rows : [];
  const hasMore = isOk(queueRes) ? queueRes.data.hasMore : false;

  const sp = searchParams as Record<string, string | undefined>;

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PR Queue</h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
            Pull Request Management
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FilterLink
          label="OPEN"
          href={buildHref(sp, { state: 'open', page: '0' })}
          active={filters.state?.includes('open') ?? false}
        />
        <FilterLink
          label="MERGED"
          href={buildHref(sp, { state: 'merged', page: '0' })}
          active={filters.state?.includes('merged') ?? false}
        />
        <FilterLink
          label="CLOSED"
          href={buildHref(sp, { state: 'closed', page: '0' })}
          active={filters.state?.includes('closed') ?? false}
        />
        <span className="text-[#30363d]">|</span>
        <FilterLink
          label="VERIFIED"
          href={buildHref(sp, { verified: 'yes', page: '0' })}
          active={searchParams.verified === 'yes'}
        />
        <FilterLink
          label="UNVERIFIED"
          href={buildHref(sp, { verified: 'no', page: '0' })}
          active={searchParams.verified === 'no'}
        />
        <FilterLink
          label="ALL"
          href={buildHref({ ...sp, verified: undefined }, { page: '0' })}
          active={!searchParams.verified}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22]">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-zinc-500">
            No PRs match your filters.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#30363d] text-[10px] uppercase tracking-widest text-[#8b949e]">
                <th className="px-5 py-3 text-left font-medium">PR #</th>
                <th className="px-5 py-3 text-left font-medium">Title</th>
                <th className="px-5 py-3 text-left font-medium">Contributor</th>
                <th className="px-5 py-3 text-left font-medium">Level</th>
                <th className="px-5 py-3 text-left font-medium">Verification</th>
                <th className="px-5 py-3 text-left font-medium">Age</th>
                <th className="px-5 py-3 text-left font-medium">Repo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]/40">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[#0d1117]/40">
                  <td className="px-5 py-3 font-mono text-[#8b949e]">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[#00d26a]"
                    >
                      #{row.number}
                    </a>
                  </td>
                  <td className="max-w-[220px] px-5 py-3">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-white hover:text-[#00d26a]"
                      title={row.title}
                    >
                      {row.title}
                    </a>
                    {row.draft && (
                      <span className="mt-0.5 inline-block rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
                        DRAFT
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#8b949e]">@{row.authorLogin}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${levelBadge(row.authorLevel)}`}
                    >
                      L{row.authorLevel ?? '?'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <VerificationBadge row={row} />
                  </td>
                  <td className="px-5 py-3 text-[#8b949e]">{relativeTime(row.githubUpdatedAt)}</td>
                  <td className="px-5 py-3 text-[10px] text-[#8b949e]">{row.repoFullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="mt-4 flex items-center justify-between text-[11px]">
          {page > 0 ? (
            <Link
              href={buildHref(sp, { page: String(page - 1) })}
              className="rounded border border-[#30363d] px-4 py-2 text-[#8b949e] transition-colors hover:text-white"
            >
              ← Previous
            </Link>
          ) : (
            <div />
          )}
          <span className="text-[#8b949e]">Page {page + 1}</span>
          {hasMore ? (
            <Link
              href={buildHref(sp, { page: String(page + 1) })}
              className="rounded border border-[#30363d] px-4 py-2 text-[#8b949e] transition-colors hover:text-white"
            >
              Next →
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}
