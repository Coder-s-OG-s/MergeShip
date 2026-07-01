import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer, listMaintainerRepos } from '@/lib/maintainer/detect';
import { RequestChangesButton } from './request-changes-button';
import { ClosePrButton } from './close-pr-button';

export const dynamic = 'force-dynamic';

export default async function PrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prId = Number(id);
  if (isNaN(prId)) return notFound();

  const sb = await getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const isMaintainer = await isUserMaintainer(user.id);
  if (!isMaintainer) redirect('/');

  const service = getServiceSupabase();
  if (!service) return notFound();

  const { data: pr } = await service
    .from('pull_requests')
    .select(
      'id, title, repo_full_name, number, author_login, author_user_id, state, draft, url, mentor_verified',
    )
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return notFound();

  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) return notFound();

  const scoped = await listMaintainerRepos(user.id, repoRow.installation_id);
  if (!scoped.includes(pr.repo_full_name)) return notFound();

  const { data: profile } = pr.author_user_id
    ? await service
        .from('profiles')
        .select('github_handle, level, xp')
        .eq('id', pr.author_user_id)
        .maybeSingle()
    : { data: null };

  const stateColor =
    pr.state === 'open'
      ? 'bg-emerald-900/40 text-emerald-300'
      : pr.state === 'merged'
        ? 'bg-purple-900/40 text-purple-300'
        : 'bg-zinc-800 text-zinc-400';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/maintainer"
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        ← Back to PR Queue
      </Link>

      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateColor}`}>
            {pr.state}
          </span>
          {pr.draft && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              Draft
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold text-white">{pr.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          <span>@{pr.author_login ?? 'unknown'}</span>
          {profile && <span>· L{profile.level}</span>}
          <span>
            · {pr.repo_full_name} #{pr.number}
          </span>
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-white"
          >
            GH →
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Merge Decision
        </h2>
        {pr.state === 'open' ? (
          <div className="flex flex-wrap gap-3">
            <RequestChangesButton prId={prId} />
            <ClosePrButton prId={prId} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            This PR is already {pr.state} — no actions available.
          </p>
        )}
      </div>
    </div>
  );
}
