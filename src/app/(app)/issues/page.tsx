import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { getIssuesPage, getRepoOptions, type RepoOption } from '@/app/actions/issues';
import { IssuesList } from './issues-list';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  state?: string;
  difficulty?: string;
  repo?: string;
  claimed?: string;
  page?: string;
};

type LinkedRec = {
  id: number;
  linked_pr_url: string;
  status: string;
  xp_reward: number;
  issues: {
    title: string;
    repo_full_name: string;
    url: string;
  } | null;
};

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const sb = getServerSupabase();
  if (!sb)
    return (
      <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">Not configured</div>
    );

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const filters = {
    search: searchParams.q,
    state: (searchParams.state === 'closed' ? 'closed' : 'open') as 'open' | 'closed',
    difficulty: (['E', 'M', 'H'].includes(searchParams.difficulty ?? '')
      ? searchParams.difficulty
      : undefined) as 'E' | 'M' | 'H' | undefined,
    repo: searchParams.repo,
    showClaimed: searchParams.claimed === 'true',
    page: Math.max(1, parseInt(searchParams.page ?? '1') || 1),
  };

  const service = getServiceSupabase();

  const [pageResult, repoResult, linkedRecsResult] = await Promise.all([
    getIssuesPage(filters),
    getRepoOptions(),
    service
      ? service
          .from('recommendations')
          .select(`id, linked_pr_url, status, xp_reward, issues ( title, repo_full_name, url )`)
          .eq('user_id', user.id)
          .not('linked_pr_url', 'is', null)
          .order('id', { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const pageData = pageResult.ok
    ? pageResult.data
    : { issues: [], total: 0, page: 1, pageSize: 10 };

  const repoOptions: RepoOption[] = repoResult.ok ? repoResult.data : [];
  const linkedRecs = (linkedRecsResult.data ?? []) as LinkedRec[];

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 border-b border-[#2d333b] pb-6">
          <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
            02 / ISSUES
          </div>
          <h1 className="font-serif text-4xl text-white">Browse Issues</h1>
        </header>

        {linkedRecs.length > 0 && (
          <section className="mb-16">
            <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
              <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">MY WORK</h2>
              <span className="text-[11px] uppercase tracking-widest text-zinc-600">
                PR SUBMITTED
              </span>
            </div>
            <div>
              {linkedRecs.map((rec) => (
                <div key={rec.id} className="border-b border-[#2d333b] py-5 last:border-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                      {rec.issues?.repo_full_name ?? '—'}
                    </span>
                    <StatusBadge status={rec.status} />
                  </div>

                  <div className="mb-3 flex items-start justify-between gap-4">
                    <a
                      href={rec.issues?.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-serif text-lg leading-snug text-white hover:text-zinc-300"
                    >
                      {rec.issues?.title ?? 'Untitled Issue'}
                    </a>
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-emerald-600">
                      +{rec.xp_reward} XP
                    </span>
                  </div>

                  <a
                    href={rec.linked_pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {rec.linked_pr_url.replace('https://github.com/', '')}
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        <IssuesList initialData={pageData} initialFilters={filters} repoOptions={repoOptions} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    claimed: 'border-purple-800 text-purple-400',
    completed: 'border-emerald-800 text-emerald-400',
    expired: 'border-zinc-700 text-zinc-500',
    reassigned: 'border-zinc-700 text-zinc-500',
  };
  const cls = map[status] ?? 'border-zinc-700 text-zinc-500';
  return (
    <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-widest ${cls}`}>
      {status}
    </span>
  );
}
