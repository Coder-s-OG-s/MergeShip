import { getServiceSupabase } from '@/lib/supabase/service';

type Props = {
  userId: string;
  primaryLanguage: string | null;
};

export default async function RepositoryMatches({ userId, primaryLanguage }: Props) {
  const service = getServiceSupabase();
  if (!service) return null;

  // Build query — filter by language only if the user has one set
  let query = service
    .from('issues')
    .select('repo_full_name, repo_language, repo_health_score')
    .eq('state', 'open')
    .gte('repo_health_score', 40)
    .order('repo_health_score', { ascending: false })
    .limit(100);

  if (primaryLanguage) {
    query = query.eq('repo_language', primaryLanguage);
  }

  const { data: issueRows } = await query;

  // Deduplicate by repo_full_name, count open issues per repo
  const repoMap = new Map<
    string,
    {
      repoFullName: string;
      repoLanguage: string | null;
      repoHealthScore: number;
      openIssueCount: number;
    }
  >();

  for (const row of issueRows ?? []) {
    if (repoMap.has(row.repo_full_name)) {
      repoMap.get(row.repo_full_name)!.openIssueCount += 1;
    } else {
      repoMap.set(row.repo_full_name, {
        repoFullName: row.repo_full_name,
        repoLanguage: row.repo_language,
        repoHealthScore: row.repo_health_score ?? 0,
        openIssueCount: 1,
      });
    }
  }

  const matchingRepos = Array.from(repoMap.values()).slice(0, 8);

  return (
    <section>
      <div className="mb-6 border-b border-[#2d333b] pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">REPO MATCHES</h2>
          <span className="text-[10px] uppercase tracking-widest text-zinc-600">
            {primaryLanguage ?? 'ALL LANGUAGES'}
          </span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-zinc-600">
          MATCHING FILTERS
        </div>
      </div>

      {matchingRepos.length === 0 ? (
        <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
          No matches found.{' '}
          {!primaryLanguage && 'Set a primary language in your profile to filter results.'}
        </div>
      ) : (
        <div>
          {matchingRepos.map((repo) => (
            <div key={repo.repoFullName} className="border-b border-[#2d333b] py-4 last:border-0">
              <a
                href={`https://github.com/${repo.repoFullName}`}
                target="_blank"
                rel="noreferrer"
                className="mb-1 block truncate text-[11px] uppercase tracking-widest text-zinc-200 hover:text-white"
              >
                {repo.repoFullName}
              </a>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                  {repo.repoLanguage ?? 'Unknown'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                    {repo.openIssueCount} {repo.openIssueCount === 1 ? 'ISSUE' : 'ISSUES'}
                  </span>
                  <span className="text-[10px] tabular-nums text-[#10b981]">
                    /{repo.repoHealthScore}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RepositoryMatchesSkeleton() {
  return (
    <section>
      <div className="mb-6 border-b border-[#2d333b] pb-4">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 animate-pulse bg-zinc-800" />
          <div className="h-3 w-16 animate-pulse bg-zinc-800" />
        </div>
        <div className="mt-1 h-2.5 w-28 animate-pulse bg-zinc-800" />
      </div>
      <div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border-b border-[#2d333b] py-4 last:border-0">
            <div className="mb-2 h-3 w-4/5 animate-pulse bg-zinc-800" />
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-16 animate-pulse bg-zinc-800" />
              <div className="h-2.5 w-20 animate-pulse bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
