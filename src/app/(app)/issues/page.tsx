import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { getIssuesPage, getRepoOptions, type RepoOption } from '@/app/actions/issues';
import { IssuesList } from './issues-list';
import { MyWorkSection, type LinkedRec } from './my-work-section';

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

  const service = getServiceSupabase();

  // Step 1: fetch recs with linked PRs
  const linkedRecsRaw = service
    ? ((
        await service
          .from('recommendations')
          .select('id, linked_pr_url, status, xp_reward, issue_id')
          .eq('user_id', user.id)
          .not('linked_pr_url', 'is', null)
          .order('id', { ascending: false })
      ).data ?? [])
    : [];

  // Step 2: fetch issue details separately (avoids FK detection issues)
  let issueMap = new Map<number, { title: string; repo_full_name: string; url: string }>();
  if (linkedRecsRaw.length > 0 && service) {
    const issueIds = linkedRecsRaw.map((r: any) => r.issue_id).filter(Boolean);
    const { data: issuesData } = await service
      .from('issues')
      .select('id, title, repo_full_name, url')
      .in('id', issueIds);
    for (const issue of issuesData ?? []) {
      issueMap.set(issue.id, issue);
    }
  }

  const linkedRecs: LinkedRec[] = linkedRecsRaw.map((r: any) => ({
    id: r.id,
    linked_pr_url: r.linked_pr_url as string,
    status: r.status as string,
    xp_reward: r.xp_reward as number,
    issue_id: r.issue_id as number,
    issue: issueMap.get(r.issue_id) ?? null,
  }));

  const [pageResult, repoResult] = await Promise.all([getIssuesPage(filters), getRepoOptions()]);

  const pageData = pageResult.ok
    ? pageResult.data
    : { issues: [], total: 0, page: 1, pageSize: 10 };

  const repoOptions: RepoOption[] = repoResult.ok ? repoResult.data : [];

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 border-b border-[#2d333b] pb-6">
          <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
            02 / ISSUES
          </div>
          <h1 className="font-serif text-4xl text-white">Browse Issues</h1>
        </header>

        {linkedRecs.length > 0 && <MyWorkSection initialRecs={linkedRecs} />}

        <IssuesList initialData={pageData} initialFilters={filters} repoOptions={repoOptions} />
      </div>
    </div>
  );
}
