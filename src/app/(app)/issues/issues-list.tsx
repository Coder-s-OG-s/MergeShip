'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { Search, ExternalLink, ChevronLeft, ChevronRight, Copy, Check, X } from 'lucide-react';
import {
  claimIssue,
  unclaimIssue,
  type IssueWithStatus,
  type IssueFilter,
  type IssuesPageResult,
  type RepoOption,
} from '@/app/actions/issues';

const DIFFICULTY_LABEL: Record<string, string> = { E: 'L1', M: 'L2', H: 'L3' };
const DIFFICULTY_COLOR: Record<string, string> = {
  E: 'border-emerald-700 text-emerald-400',
  M: 'border-yellow-700 text-yellow-400',
  H: 'border-red-800 text-red-400',
};

const DIFFICULTY_FULL: Record<string, string> = {
  E: 'Easy — good for first contributions, lower XP',
  M: 'Medium — requires some codebase knowledge',
  H: 'Hard — significant complexity, higher XP',
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

// ---------------------------------------------------------------------------
// Issue Detail Drawer
// ---------------------------------------------------------------------------

function IssueDetailDrawer({
  issue,
  onClose,
  onClaim,
  onUnclaim,
  actionPending,
}: {
  issue: IssueWithStatus;
  onClose: () => void;
  onClaim: (id: number) => void;
  onUnclaim: (recId: number, issueId: number) => void;
  actionPending: boolean;
}) {
  const isClaimed = issue.userRecStatus === 'claimed';
  const repoName = issue.repoFullName.split('/')[1] ?? issue.repoFullName;
  const org = issue.repoFullName.split('/')[0] ?? '';
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(issue.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={issue.title}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-[#2d333b] bg-[#111318] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d333b] px-6 py-4">
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
          <button
            onClick={onClose}
            className="ml-4 shrink-0 text-zinc-500 transition-colors hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Title */}
          <h2 className="mb-1 font-serif text-2xl leading-snug text-white">{issue.title}</h2>

          {/* Meta */}
          <p className="mb-6 text-[10px] uppercase tracking-widest text-zinc-600">
            #{issue.githubIssueNumber} · {timeAgo(issue.fetchedAt)}
          </p>

          {/* Difficulty description */}
          {issue.difficulty && (
            <div className="mb-6 border border-[#2d333b] bg-[#161b22] px-4 py-3">
              <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                Difficulty
              </p>
              <p className="text-[11px] text-zinc-300">
                {DIFFICULTY_FULL[issue.difficulty] ?? issue.difficulty}
              </p>
            </div>
          )}

          {/* XP Reward */}
          {issue.xpReward && (
            <div className="mb-6 border border-[#2d333b] bg-[#161b22] px-4 py-3">
              <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                XP Reward
              </p>
              <p className="text-[11px] font-bold text-emerald-400">+{issue.xpReward} XP</p>
            </div>
          )}

          {/* Labels */}
          {issue.labels && issue.labels.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">Labels</p>
              <div className="flex flex-wrap gap-2">
                {issue.labels.map((label) => (
                  <span
                    key={label}
                    className="border border-[#2d333b] px-2 py-0.5 text-[10px] text-zinc-400"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* State */}
          <div className="mb-6 border border-[#2d333b] bg-[#161b22] px-4 py-3">
            <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">Status</p>
            <p
              className={`text-[11px] font-bold uppercase ${issue.state === 'open' ? 'text-emerald-400' : 'text-zinc-500'}`}
            >
              {issue.state}
            </p>
          </div>

          {/* GitHub link */}
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 flex items-center gap-2 border border-[#2d333b] px-4 py-3 text-[11px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-[#161b22]"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            VIEW ON GITHUB
          </a>
        </div>

        {/* Footer actions */}
        <div className="border-t border-[#2d333b] px-6 py-4">
          {isClaimed ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-purple-400">
                YOUR ISSUE
              </span>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                {copied ? (
                  <>
                    COPIED <Check className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    COPY URL <Copy className="h-3 w-3" />
                  </>
                )}
              </button>

              <button
                onClick={() => issue.userRecId && onUnclaim(issue.userRecId, issue.id)}
                disabled={actionPending || !issue.userRecId}
                className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:border-red-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending ? '...' : 'UNCLAIM'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onClaim(issue.id)}
                disabled={actionPending}
                className="border border-zinc-600 px-4 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending ? 'CLAIMING...' : 'CLAIM ISSUE'}
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {copied ? (
                  <>
                    COPIED <Check className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    COPY URL <Copy className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// IssueCard
// ---------------------------------------------------------------------------

function IssueCard({
  issue,
  onClaim,
  onUnclaim,
  actionPending,
  onOpenDetail,
}: {
  issue: IssueWithStatus;
  onClaim: (id: number) => void;
  onUnclaim: (recId: number, issueId: number) => void;
  actionPending: boolean;
  onOpenDetail: (issue: IssueWithStatus) => void;
}) {
  const isClaimed = issue.userRecStatus === 'claimed';
  const repoName = issue.repoFullName.split('/')[1] ?? issue.repoFullName;
  const org = issue.repoFullName.split('/')[0] ?? '';

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(issue.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
              title={
                issue.difficulty === 'E'
                  ? 'Easy — good for first contributions, lower XP'
                  : issue.difficulty === 'M'
                    ? 'Medium — requires some codebase knowledge'
                    : issue.difficulty === 'H'
                      ? 'Hard — significant complexity, higher XP'
                      : ''
              }
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

      {/* Title now opens the detail drawer instead of navigating to GitHub */}
      <button
        onClick={() => onOpenDetail(issue)}
        className="mb-3 block w-full text-left font-serif text-xl leading-snug text-white hover:text-zinc-300"
      >
        {issue.title}
      </button>

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

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              {copied ? (
                <>
                  COPIED <Check className="h-3 w-3" />
                </>
              ) : (
                <>
                  COPY <Copy className="h-3 w-3" />
                </>
              )}
            </button>

            <button
              onClick={() => issue.userRecId && onUnclaim(issue.userRecId, issue.id)}
              disabled={actionPending || !issue.userRecId}
              className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:border-red-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionPending ? '...' : 'UNCLAIM'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onClaim(issue.id)}
              disabled={actionPending}
              className="border border-zinc-600 px-4 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionPending ? 'CLAIMING...' : 'CLAIM ISSUE'}
            </button>

            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
            >
              VIEW <ExternalLink className="h-3 w-3" />
            </a>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {copied ? (
                <>
                  COPIED <Check className="h-3 w-3" />
                </>
              ) : (
                <>
                  COPY <Copy className="h-3 w-3" />
                </>
              )}
            </button>
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

// ---------------------------------------------------------------------------
// IssuesList
// ---------------------------------------------------------------------------

export function IssuesList({
  initialData,
  initialFilters,
  repoOptions,
}: {
  initialData: IssuesPageResult;
  initialFilters: IssueFilter;
  repoOptions: RepoOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [actionIssueId, setActionIssueId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState(initialFilters.search ?? '');
  const [state, setState] = useState<'open' | 'closed'>(initialFilters.state ?? 'open');
  const [difficulty, setDifficulty] = useState<string>(initialFilters.difficulty ?? '');
  const [repo, setRepo] = useState<string>(initialFilters.repo ?? '');
  const [showClaimed, setShowClaimed] = useState(initialFilters.showClaimed ?? false);

  // Detail drawer state
  const [selectedIssue, setSelectedIssue] = useState<IssueWithStatus | null>(null);

  // Keep drawer in sync when the underlying list refreshes (e.g. after claim/unclaim)
  useEffect(() => {
    if (!selectedIssue) return;
    const updated = initialData.issues.find((i) => i.id === selectedIssue.id);
    if (updated) setSelectedIssue(updated);
  }, [initialData.issues]);

  const navigate = useCallback(
    (
      overrides: Partial<{
        q: string;
        state: string;
        difficulty: string;
        repo: string;
        claimed: string;
        page: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      const q = overrides.q ?? search;
      const st = overrides.state ?? state;
      const diff = overrides.difficulty ?? difficulty;
      const r = overrides.repo ?? repo;
      const sc = overrides.claimed ?? String(showClaimed);
      const pg = overrides.page ?? '1';
      if (q) params.set('q', q);
      if (st !== 'open') params.set('state', st);
      if (diff) params.set('difficulty', diff);
      if (r) params.set('repo', r);
      if (sc === 'true') {
        params.set('claimed', 'true');
      } else {
        params.delete('claimed');
      }
      if (pg !== '1') params.set('page', pg);
      startTransition(() => {
        router.push(`/issues${params.size > 0 ? `?${params.toString()}` : ''}`);
      });
    },
    [router, search, state, difficulty, repo, showClaimed],
  );

  const handleClaim = async (issueId: number) => {
    setActionIssueId(issueId);
    setActionError(null);
    const result = await claimIssue(issueId);
    setActionIssueId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    router.refresh();
  };

  const handleUnclaim = async (recId: number, issueId: number) => {
    setActionIssueId(issueId);
    setActionError(null);
    const result = await unclaimIssue(recId);
    setActionIssueId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    router.refresh();
  };

  const totalPages = Math.ceil(initialData.total / initialData.pageSize);
  const currentPage = initialData.page;

  return (
    <div>
      {/* Filters */}
      <div className="mb-10 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
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

        {repoOptions.length > 0 && (
          <select
            value={repo}
            onChange={(e) => {
              setRepo(e.target.value);
              navigate({ repo: e.target.value, page: '1' });
            }}
            className="border border-[#2d333b] bg-[#161b22] px-3 py-2 text-[11px] uppercase tracking-widest text-zinc-300 outline-none focus:border-zinc-500"
          >
            <option value="">ALL REPOS</option>
            {repoOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

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

      {actionError && (
        <div className="mb-6 border border-red-800 bg-red-900/20 px-4 py-3 text-[11px] uppercase tracking-widest text-red-400">
          {actionError}
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
              onUnclaim={handleUnclaim}
              actionPending={actionIssueId === issue.id}
              onOpenDetail={setSelectedIssue}
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

      {/* Issue Detail Drawer */}
      {selectedIssue && (
        <IssueDetailDrawer
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onClaim={handleClaim}
          onUnclaim={handleUnclaim}
          actionPending={actionIssueId === selectedIssue.id}
        />
      )}
    </div>
  );
}
