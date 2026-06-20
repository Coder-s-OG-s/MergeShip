'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, GitPullRequest } from 'lucide-react';
import { setRepoManaged, type RepoPickerRow } from '@/app/actions/maintainer';

// A small, deliberately incomplete palette — anything unmapped falls back to
// zinc so an unknown language still renders a (neutral) dot.
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4F5D95',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
};

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const diffMs = Date.now() - t;
  // Future skew (clock differences) shouldn't render as a negative age.
  if (diffMs < 0) return 'just now';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function RepoPicker({
  installationId,
  initialRepos,
}: {
  installationId: number;
  initialRepos: RepoPickerRow[];
}) {
  const router = useRouter();
  const [repos, setRepos] = useState<RepoPickerRow[]>(initialRepos);
  const [filter, setFilter] = useState('');
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.repoFullName.toLowerCase().includes(q));
  }, [repos, filter]);

  const managedCount = repos.filter((r) => r.managed).length;

  function toggle(repoFullName: string, next: boolean) {
    // Optimistic flip. Capture the exact prior value so a failed write reverts
    // to where the row actually was, not just the inverse of this toggle (which
    // would be wrong under rapid successive failures).
    let prevManaged: boolean | undefined;
    setRepos((prev) =>
      prev.map((r) => {
        if (r.repoFullName !== repoFullName) return r;
        prevManaged = r.managed;
        return { ...r, managed: next };
      }),
    );
    startTransition(async () => {
      const res = await setRepoManaged({ installationId, repoFullName, managed: next });
      if (!res.ok) {
        setRepos((prev) =>
          prev.map((r) =>
            r.repoFullName === repoFullName ? { ...r, managed: prevManaged ?? !next } : r,
          ),
        );
      }
    });
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pick repos to manage</h1>
        <p className="mt-1 text-sm text-zinc-400">
          MergeShip is installed on these repos. Choose which ones it actively manages.
        </p>
      </div>

      <div className="relative">
        <label htmlFor="repo-filter" className="sr-only">
          Filter repositories
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          id="repo-filter"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter repositories"
          className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-neon-green/50 focus:outline-none"
        />
      </div>

      <ul className="flex flex-col gap-2">
        {visible.length === 0 ? (
          <li className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
            No repositories match.
          </li>
        ) : (
          visible.map((repo) => (
            <li key={repo.repoFullName}>
              <button
                type="button"
                onClick={() => toggle(repo.repoFullName, !repo.managed)}
                aria-pressed={repo.managed}
                className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${
                  repo.managed
                    ? 'border-neon-green/40 bg-neon-green/[0.06]'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    repo.managed
                      ? 'border-neon-green bg-neon-green text-black'
                      : 'border-zinc-600 bg-transparent'
                  }`}
                >
                  {repo.managed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {repo.repoFullName}
                </span>

                <span className="flex shrink-0 items-center gap-4 text-xs text-zinc-500">
                  {repo.language && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: LANGUAGE_COLORS[repo.language] ?? '#71717a' }}
                      />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <GitPullRequest className="h-3.5 w-3.5" />
                    {repo.openPrCount}
                  </span>
                  <span className="tabular-nums">{relativeTime(repo.lastUpdatedAt)}</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <button
        type="button"
        disabled={managedCount === 0}
        onClick={() => router.push('/maintainer')}
        className="mt-2 w-full rounded-md bg-neon-green px-5 py-3.5 text-center font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        Connect {managedCount} {managedCount === 1 ? 'repo' : 'repos'} and continue
      </button>
    </div>
  );
}
