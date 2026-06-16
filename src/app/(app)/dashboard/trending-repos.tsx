import { getServiceSupabase } from '@/lib/supabase/service';

export default async function TrendingRepos() {
  const service = getServiceSupabase();
  if (!service) return null;

  const { data: issueRows } = await service
    .from('issues')
    .select('repo_full_name, repo_language, repo_health_score, scored_at')
    .eq('state', 'open')
    .gte('repo_health_score', 40)
    .order('repo_health_score', { ascending: false })
    .order('scored_at', { ascending: false })
    .limit(100);

  // Deduplicate: keep only the first row per repo_full_name (highest health score wins)
  const seen = new Set<string>();
  const trendingRepos: Array<{
    repoFullName: string;
    repoLanguage: string | null;
    repoHealthScore: number;
  }> = [];

  for (const row of issueRows ?? []) {
    if (!seen.has(row.repo_full_name)) {
      seen.add(row.repo_full_name);
      trendingRepos.push({
        repoFullName: row.repo_full_name,
        repoLanguage: row.repo_language,
        repoHealthScore: row.repo_health_score ?? 0,
      });
      if (trendingRepos.length >= 6) break;
    }
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">TRENDING REPOS</h2>
        <span className="text-[11px] uppercase tracking-widest text-zinc-500">BY HEALTH</span>
      </div>

      {trendingRepos.length === 0 ? (
        <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
          No trending data yet.
        </div>
      ) : (
        <div>
          {trendingRepos.map((repo, index) => (
            <div
              key={repo.repoFullName}
              className="flex items-center justify-between border-b border-[#2d333b] py-3.5 last:border-0"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <span className="w-6 shrink-0 text-[11px] text-zinc-600">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <div className="overflow-hidden">
                  <a
                    href={`https://github.com/${repo.repoFullName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[11px] uppercase tracking-widest text-zinc-200 hover:text-white"
                  >
                    {repo.repoFullName}
                  </a>
                  {repo.repoLanguage && (
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                      {repo.repoLanguage}
                    </span>
                  )}
                </div>
              </div>
              <span className="ml-4 shrink-0 text-[11px] tabular-nums text-[#10b981]">
                {repo.repoHealthScore}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TrendingReposSkeleton() {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <div className="h-3 w-28 animate-pulse bg-zinc-800" />
        <div className="h-3 w-16 animate-pulse bg-zinc-800" />
      </div>
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-[#2d333b] py-3.5 last:border-0"
          >
            <div className="flex items-center gap-4">
              <div className="h-3 w-4 animate-pulse bg-zinc-800" />
              <div className="h-3 w-36 animate-pulse bg-zinc-800" />
            </div>
            <div className="h-3 w-6 animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
