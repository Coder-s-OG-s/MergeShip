'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  claimIssue,
  type IssueWithStatus,
  type IssueFilter,
  type IssuesPageResult,
} from '@/app/actions/issues';

const DIFFICULTY_LABEL: Record<string, string> = { E: 'L1', M: 'L2', H: 'L3' };
const DIFFICULTY_COLOR: Record<string, string> = {
  E: 'border-emerald-700 text-emerald-400',
  M: 'border-yellow-700 text-yellow-400',
  H: 'border-red-800 text-red-400',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function IssueCard({
  issue,
  onClaim,
  claiming,
}: {
  issue: IssueWithStatus;
  onClaim: (id: number) => void;
  claiming: boolean;
}) {
  const isClaimed = issue.userRecStatus === 'claimed';
  const isOpen = issue.userRecStatus === 'open';
  const repoName = issue.repoFullName.split('/')[1] ?? issue.repoFullName;
  const org = issue.repoFullName.split('/')[0] ?? '';

  return (
    <div className="border-b border-[#2d333b] py-6 last:border-0">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
            {org}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">/</span>
          <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
            {repoName}
          </span>
          {issue.difficulty && (
            <span
              className={`border px-2 py-0.5 text-[10px] font-bold uppercase ${DIFFICULTY_COLOR[issue.difficulty] ?? 'border-zinc-700 text-zinc-400'}`}
            >
              {DIFFICULTY_LABEL[issue.difficulty] ?? issue.difficulty}
            </span>
          )}
          {isClaimed && (
            <span className="bg-purple-900/50 px-2 py-0.5 text-[10px] uppercase text-purple-300">
              CLAIMED
            </span>
          )}
        </div>

        <span className="shrink-0 text-[10px] uppercase tracking-widest text-zinc-600">
          {timeAgo(issue.fetchedAt)}
        </span>
      </div>

      <h3 className="mb-3 font-serif text-xl leading-snug text-white">{issue.title}</h3>

      {issue.labels && issue.labels.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {issue.labels.slice(0, 4).map((label) => (
            <span
              key={label}
              className="border border-[#2d333b] px-2 py-0.5 text-[10px] text-zinc-500"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        {isClaimed ? (
          <>
            <span className="text-[10px] uppercase tracking-widest text-purple-400">
              YOUR ISSUE
            </span>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              VIEW <ExternalLink className="h-3 w-3" />
            </a>
          </>
        ) : (
          <>
            <button
              onClick={() => onClaim(issue.id)}
              disabled={claiming}
              className="border border-zinc-600 px-4 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {claiming ? 'CLAIMING...' : 'CLAIM ISSUE'}
            </button>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
            >
              VIEW <ExternalLink className="h-3 w-3" />
            </a>
          </>
        )}
        {issue.xpReward && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-600">
            +{issue.xpReward} XP
          </span>
        )}
      </div>
    </div>
  );
}

export function IssuesList({
  initialData,
  initialFilters,
}: {
  initialData: IssuesPageResult;
  initialFilters: IssueFilter;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [search, setSearch] = useState(initialFilters.search ?? '');
  const [state, setState] = useState<'open' | 'closed'>(initialFilters.state ?? 'open');
  const [difficulty, setDifficulty] = useState<string>(initialFilters.difficulty ?? '');
  const [showClaimed, setShowClaimed] = useState(initialFilters.showClaimed ?? false);

  const navigate = useCallback(
    (
      overrides: Partial<{
        q: string;
        state: string;
        difficulty: string;
        claimed: string;
        page: string;
      }>,
    ) => {
      const params = new URLSearchParams();
      const q = overrides.q ?? search;
      const st = overrides.state ?? state;
      const diff = overrides.difficulty ?? difficulty;
      const sc = overrides.claimed ?? String(showClaimed);
      const pg = overrides.page ?? '1';
      if (q) params.set('q', q);
      if (st !== 'open') params.set('state', st);
      if (diff) params.set('difficulty', diff);
      if (sc === 'true') params.set('claimed', 'true');
      if (pg !== '1') params.set('page', pg);
      startTransition(() => {
        router.push(`/issues${params.size > 0 ? `?${params.toString()}` : ''}`);
      });
    },
    [router, search, state, difficulty, showClaimed],
  );

  const handleClaim = async (issueId: number) => {
    setClaimingId(issueId);
    setClaimError(null);
    const result = await claimIssue(issueId);
    setClaimingId(null);
    if (!result.ok) {
      setClaimError(result.error.message);
      return;
    }
    router.refresh();
  };

  const totalPages = Math.ceil(initialData.total / initialData.pageSize);
  const currentPage = initialData.page;

  return (
    <div>
      {/* Filters */}
      <div className="mb-10 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="SEARCH ISSUES"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate({ q: search, page: '1' })}
            className="w-full border border-[#2d333b] bg-[#161b22] py-2 pl-9 pr-4 text-[11px] uppercase tracking-widest text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>

        <select
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            navigate({ difficulty: e.target.value, page: '1' });
          }}
          className="border border-[#2d333b] bg-[#161b22] px-3 py-2 text-[11px] uppercase tracking-widest text-zinc-300 outline-none focus:border-zinc-500"
        >
          <option value="">ALL LEVELS</option>
          <option value="E">L1 — EASY</option>
          <option value="M">L2 — MEDIUM</option>
          <option value="H">L3 — HARD</option>
        </select>

        <select
          value={state}
          onChange={(e) => {
            const v = e.target.value as 'open' | 'closed';
            setState(v);
            navigate({ state: v, page: '1' });
          }}
          className="border border-[#2d333b] bg-[#161b22] px-3 py-2 text-[11px] uppercase tracking-widest text-zinc-300 outline-none focus:border-zinc-500"
        >
          <option value="open">OPEN</option>
          <option value="closed">CLOSED</option>
        </select>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400">
          <input
            type="checkbox"
            checked={showClaimed}
            onChange={(e) => {
              setShowClaimed(e.target.checked);
              navigate({ claimed: String(e.target.checked), page: '1' });
            }}
            className="accent-purple-500"
          />
          SHOW CLAIMED
        </label>
      </div>

      {claimError && (
        <div className="mb-6 border border-red-800 bg-red-900/20 px-4 py-3 text-[11px] uppercase tracking-widest text-red-400">
          {claimError}
        </div>
      )}

      {/* Count */}
      <div className="mb-6 text-[11px] uppercase tracking-widest text-zinc-500">
        {isPending ? 'LOADING...' : `${initialData.total} ISSUES`}
      </div>

      {/* List */}
      <div className={isPending ? 'opacity-50 transition-opacity' : ''}>
        {initialData.issues.length === 0 ? (
          <div className="py-12 text-center text-[11px] uppercase tracking-widest text-zinc-600">
            No issues found.
          </div>
        ) : (
          initialData.issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onClaim={handleClaim}
              claiming={claimingId === issue.id}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-between border-t border-[#2d333b] pt-6">
          <button
            disabled={currentPage <= 1}
            onClick={() => navigate({ page: String(currentPage - 1) })}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3 w-3" /> PREV
          </button>
          <span className="text-[11px] uppercase tracking-widest text-zinc-500">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => navigate({ page: String(currentPage + 1) })}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            NEXT <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
