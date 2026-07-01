import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { getPrDiff } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

export default async function PRDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ install?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const sb = await getServerSupabase();
  if (!sb) return notFound();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const prId = parseInt(resolvedParams.id, 10);
  const installId = parseInt(resolvedSearchParams.install || '0', 10);
  if (isNaN(prId) || isNaN(installId) || installId === 0) return notFound();

  const { data: pr } = await sb
    .from('pull_requests')
    .select('repo_full_name, number, title, url, state')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return notFound();

  const diffRes = await getPrDiff(installId, pr.repo_full_name, pr.number);
  const diffContent = isOk(diffRes) ? diffRes.data : null;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/maintainer?install=${installId}`}
          className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Back to Queue
        </Link>
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">
              {pr.title} <span className="text-zinc-500">#{pr.number}</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {pr.repo_full_name} ·{' '}
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                View on GitHub ↗
              </a>
            </p>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 bg-zinc-800/50 px-4 py-2">
            <h2 className="text-sm font-semibold text-zinc-300">Unified Diff</h2>
          </div>
          <div className="overflow-x-auto p-4 font-mono text-sm leading-tight">
            {diffContent ? (
              <pre>
                {diffContent.split('\n').map((line, i) => {
                  let colorClass = 'text-zinc-300';
                  let bgClass = '';
                  if (line.startsWith('+') && !line.startsWith('+++')) {
                    colorClass = 'text-emerald-300';
                    bgClass = 'block bg-emerald-900/20';
                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                    colorClass = 'text-red-300';
                    bgClass = 'block bg-red-900/20';
                  } else if (line.startsWith('@@')) {
                    colorClass = 'text-purple-400';
                  }

                  if (bgClass) {
                    return (
                      <div key={i} className={bgClass}>
                        <span className={colorClass}>{line || ' '}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i}>
                      <span className={colorClass}>{line || ' '}</span>
                    </div>
                  );
                })}
              </pre>
            ) : (
              <div className="py-8 text-center text-zinc-500">
                Could not fetch diff (perhaps no GitHub App credentials, or diff is too large).
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
