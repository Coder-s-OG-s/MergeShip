import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getMaintainerIssueQueue,
  type MaintainerInstall,
  type MaintainerIssueRow,
} from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import type { IssueTriageBucket } from '@/lib/maintainer/issue-triage';

export const dynamic = 'force-dynamic';

const ALL_BUCKETS: IssueTriageBucket[] = ['needs-triage', 'in-progress', 'stale', 'closed'];

const BUCKET_LABEL: Record<IssueTriageBucket, string> = {
  'needs-triage': 'Needs Triage',
  'in-progress': 'In Progress',
  stale: 'Stale',
  closed: 'Closed',
};

const BUCKET_COLOR: Record<IssueTriageBucket, string> = {
  'needs-triage': 'bg-amber-900/40 text-amber-300',
  'in-progress': 'bg-[#00d26a]/10 text-[#00d26a]',
  stale: 'bg-red-900/40 text-red-300',
  closed: 'bg-zinc-800 text-zinc-400',
};

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

export default async function MaintainerIssuesPage({
  searchParams,
}: {
  searchParams: { install?: string; bucket?: string };
}) {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  const installs: MaintainerInstall[] = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        No GitHub App installations found.
      </div>
    );
  }

  const installationId =
    searchParams.install && installs.find((i) => i.installationId === Number(searchParams.install))
      ? Number(searchParams.install)
      : installs[0]!.installationId;

  const requestedBuckets = (searchParams.bucket ?? '')
    .split(',')
    .filter((b): b is IssueTriageBucket => ALL_BUCKETS.includes(b as IssueTriageBucket));
  const buckets: IssueTriageBucket[] =
    requestedBuckets.length > 0 ? requestedBuckets : ['needs-triage', 'in-progress', 'stale'];

  const queueRes = await getMaintainerIssueQueue({ installationId, buckets });
  const rows: MaintainerIssueRow[] = isOk(queueRes) ? queueRes.data.rows : [];

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
            Issue Triage
          </p>
        </div>
      </div>

      {/* Bucket filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {ALL_BUCKETS.map((b) => {
          const active = buckets.includes(b);
          const next = active ? buckets.filter((x) => x !== b) : [...buckets, b];
          const params = new URLSearchParams();
          params.set('install', String(installationId));
          if (next.length > 0) params.set('bucket', next.join(','));
          return (
            <Link
              key={b}
              href={`/maintainer/issues?${params.toString()}`}
              className={`rounded px-3 py-1.5 text-[11px] font-medium tracking-wider transition-colors ${
                active
                  ? 'border border-[#00d26a]/30 bg-[#00d26a]/10 text-[#00d26a]'
                  : 'border border-[#30363d] text-[#8b949e] hover:border-[#8b949e] hover:text-white'
              }`}
            >
              {BUCKET_LABEL[b]}
            </Link>
          );
        })}
      </div>

      {/* Issue list */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22]">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-zinc-500">
            No issues match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-[#30363d]/40">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-4 p-5 transition-colors hover:bg-[#0d1117]/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-white hover:text-[#00d26a]"
                    >
                      {r.title}
                    </a>
                    <span className="text-[11px] text-[#8b949e]">
                      {r.repoFullName} · #{r.number}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BUCKET_COLOR[r.triage]}`}
                    >
                      {BUCKET_LABEL[r.triage]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8b949e]">
                    {r.authorLogin && <span>opened by @{r.authorLogin}</span>}
                    {r.assigneeLogin && (
                      <>
                        <span className="text-[#30363d]">·</span>
                        <span>assigned to @{r.assigneeLogin}</span>
                      </>
                    )}
                    {r.commentsCount > 0 && (
                      <>
                        <span className="text-[#30363d]">·</span>
                        <span>
                          {r.commentsCount} comment{r.commentsCount === 1 ? '' : 's'}
                        </span>
                      </>
                    )}
                    {r.lastEventAt && (
                      <>
                        <span className="text-[#30363d]">·</span>
                        <span>{relativeTime(r.lastEventAt)}</span>
                      </>
                    )}
                  </div>
                  {r.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.labels.slice(0, 6).map((l) => (
                        <span
                          key={l}
                          className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
