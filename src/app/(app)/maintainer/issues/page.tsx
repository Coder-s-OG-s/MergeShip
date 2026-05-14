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
  'needs-triage': 'Needs triage',
  'in-progress': 'In progress',
  stale: 'Stale',
  closed: 'Closed',
};

const BUCKET_COLOR: Record<IssueTriageBucket, string> = {
  'needs-triage': 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-700/40',
  'in-progress': 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-700/40',
  stale: 'bg-rose-900/40 text-rose-300 ring-1 ring-rose-700/40',
  closed: 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/40',
};

export default async function MaintainerIssuesPage({
  searchParams,
}: {
  searchParams: { install?: string; bucket?: string };
}) {
  const sb = getServerSupabase();
  if (!sb) return <NotConfigured />;
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

  const requestedBuckets = (searchParams.bucket ?? '')
    .split(',')
    .filter((b): b is IssueTriageBucket => ALL_BUCKETS.includes(b as IssueTriageBucket));
  const buckets: IssueTriageBucket[] =
    requestedBuckets.length > 0 ? requestedBuckets : ['needs-triage', 'in-progress', 'stale'];

  const queueRes = await getMaintainerIssueQueue({
    installationId: activeInstallId,
    buckets,
  });
  const rows: MaintainerIssueRow[] = isOk(queueRes) ? queueRes.data.rows : [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Issue triage</h1>
          <Link
            href={`/maintainer?install=${activeInstallId}`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← PR queue
          </Link>
        </header>

        {installs.length > 1 && (
          <nav className="mb-6 flex flex-wrap gap-2 text-sm">
            {installs.map((i) => (
              <Link
                key={i.installationId}
                href={`/maintainer/issues?install=${i.installationId}`}
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
          {ALL_BUCKETS.map((b) => (
            <BucketPill
              key={b}
              label={BUCKET_LABEL[b]}
              bucket={b}
              active={buckets.includes(b)}
              current={buckets}
              installId={activeInstallId}
            />
          ))}
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          {activeInstall.accountLogin} ({activeInstall.permissionLevel.replace('_', ' ')})
        </p>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            No issues match. Try widening the filter — or the install hasn&apos;t seen any issue
            webhooks yet.
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BUCKET_COLOR[r.triage]}`}
                    >
                      {BUCKET_LABEL[r.triage]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {r.authorLogin && <span>opened by @{r.authorLogin}</span>}
                    {r.assigneeLogin && (
                      <>
                        <span className="text-zinc-600">·</span>
                        <span>assigned to @{r.assigneeLogin}</span>
                      </>
                    )}
                    {r.commentsCount > 0 && (
                      <>
                        <span className="text-zinc-600">·</span>
                        <span>
                          {r.commentsCount} comment{r.commentsCount === 1 ? '' : 's'}
                        </span>
                      </>
                    )}
                    {r.lastEventAt && (
                      <>
                        <span className="text-zinc-600">·</span>
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

function BucketPill({
  label,
  bucket,
  active,
  current,
  installId,
}: {
  label: string;
  bucket: IssueTriageBucket;
  active: boolean;
  current: IssueTriageBucket[];
  installId: number;
}) {
  // Toggle: if currently active, remove from filter; otherwise add.
  const next = active ? current.filter((b) => b !== bucket) : [...current, bucket];
  const params = new URLSearchParams();
  params.set('install', String(installId));
  if (next.length > 0) params.set('bucket', next.join(','));
  return (
    <Link
      href={`/maintainer/issues?${params.toString()}`}
      className={`rounded-lg px-2.5 py-1 ${
        active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
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

function NoInstalls() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-3 font-display text-3xl font-bold">No installs</h1>
        <p className="text-zinc-400">Install the MergeShip App to see issues here.</p>
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
