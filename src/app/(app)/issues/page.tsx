import { getServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getIssuesPage, getRepoOptions } from '@/app/actions/issues';
import { IssuesList } from './issues-list';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  state?: string;
  difficulty?: string;
  repo?: string;
  claimed?: string;
  page?: string;
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

  const [pageResult, repoResult] = await Promise.all([getIssuesPage(filters), getRepoOptions()]);

  const pageData = pageResult.ok
    ? pageResult.data
    : { issues: [], total: 0, page: 1, pageSize: 10 };

  const repoOptions = repoResult.ok ? repoResult.data : [];

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 border-b border-[#2d333b] pb-6">
          <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
            02 / ISSUES
          </div>
          <h1 className="font-serif text-4xl text-white">Browse Issues</h1>
        </header>

        <IssuesList initialData={pageData} initialFilters={filters} repoOptions={repoOptions} />
      </div>
    </div>
  );
}
