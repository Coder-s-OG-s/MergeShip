'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useTransition, useCallback, useEffect } from 'react';
import {
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  X,
  Lock,
  Unlock,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import {
  claimIssue,
  unclaimIssue,
  type IssueWithStatus,
  type IssueFilter,
  type IssuesPageResult,
  type RepoOption,
} from '@/app/actions/issues';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const difficultyText: Record<string, string> = { E: 'EASY', M: 'MEDIUM', H: 'HARD' };
  const difficultyColor: Record<string, string> = {
    E: 'border-emerald-800 text-emerald-400 bg-emerald-950/20',
    M: 'border-amber-800 text-amber-400 bg-amber-950/20',
    H: 'border-red-850 text-red-400 bg-red-950/20',
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={issue.title}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl animate-slide-in flex-col border-l border-zinc-800 bg-[#0D0E12] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
              {org}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">/</span>
            <span className="border border-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
              {repoName}
            </span>
            {issue.difficulty && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${difficultyColor[issue.difficulty]}`}
              >
                {difficultyText[issue.difficulty]}
              </span>
            )}
            {isClaimed && (
              <span className="rounded-full border border-purple-800/50 bg-purple-900/30 px-2 py-0.5 text-[10px] uppercase text-purple-300">
                CLAIMED
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-550 ml-4 shrink-0 transition-colors hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div>
            <h2 className="mb-2 font-serif text-2xl leading-snug text-white">{issue.title}</h2>
            <p className="text-zinc-650 text-[10px] uppercase tracking-widest">
              #{issue.githubIssueNumber} · {timeAgo(issue.fetchedAt)}
            </p>
          </div>

          {issue.difficulty && (
            <div className="rounded border border-zinc-800 bg-[#161b22]/20 px-4 py-3">
              <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                Difficulty
              </p>
              <p
                className={`text-xs font-bold ${(difficultyColor[issue.difficulty] ?? '').split(' ')[1] ?? 'text-zinc-300'}`}
              >
                {difficultyText[issue.difficulty]} Tier
              </p>
            </div>
          )}

          {issue.xpReward && (
            <div className="rounded border border-zinc-800 bg-[#161b22]/20 px-4 py-3">
              <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                XP Reward
              </p>
              <p className="text-xs font-bold text-[#00FF87]">+{issue.xpReward} XP</p>
            </div>
          )}

          {issue.labels && issue.labels.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">Labels</p>
              <div className="flex flex-wrap gap-2">
                {issue.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-sm border border-zinc-800 bg-zinc-900/30 px-2 py-0.5 text-[10px] text-zinc-400"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {issue.bodyExcerpt && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">Excerpt</p>
              <p className="text-zinc-450 rounded border border-zinc-800/40 bg-[#161b22]/10 p-4 text-xs leading-relaxed">
                {issue.bodyExcerpt}
              </p>
            </div>
          )}

          <div className="rounded border border-zinc-800 bg-[#161b22]/20 px-4 py-3">
            <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">Status</p>
            <p
              className={`text-xs font-bold uppercase ${issue.state === 'open' ? 'text-[#00FF87]' : 'text-zinc-500'}`}
            >
              {issue.state}
            </p>
          </div>

          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded border border-zinc-800 bg-[#161b22]/30 px-4 py-3 text-[11px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-[#161b22]/50"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            VIEW ON GITHUB
          </a>
        </div>

        {/* Footer actions */}
        <div className="border-t border-zinc-800 bg-zinc-950/20 px-6 py-4">
          {isClaimed ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="mr-auto text-[10px] font-bold uppercase tracking-widest text-purple-400">
                YOUR CLAIMED ISSUE
              </span>

              <button
                onClick={handleCopy}
                className="text-zinc-350 flex items-center gap-1 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors hover:bg-zinc-800"
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
                className="border border-zinc-800 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:border-red-950 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending ? '...' : 'UNCLAIM'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onClaim(issue.id)}
                disabled={actionPending}
                className="border-zinc-750 rounded border bg-[#00FF87]/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#00FF87] transition-colors hover:bg-[#00FF87]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending ? 'CLAIMING...' : 'CLAIM ISSUE'}
              </button>

              <button
                onClick={handleCopy}
                className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
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

  const difficultyText: Record<string, string> = { E: 'EASY', M: 'MEDIUM', H: 'HARD' };
  const difficultyColor: Record<string, string> = {
    E: 'border-emerald-800/60 text-emerald-400 bg-emerald-950/20',
    M: 'border-amber-800/60 text-amber-400 bg-amber-950/20',
    H: 'border-red-800/60 text-red-400 bg-red-950/20',
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-[#161b22]/10 p-5 transition-all duration-300 hover:border-zinc-700">
      {/* Monospace Repo and Number + Time */}
      <div className="flex items-center justify-between gap-4 font-mono text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-zinc-300">{org}</span>
          <span className="text-zinc-600">/</span>
          <span className="font-bold text-zinc-300">{repoName}</span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-zinc-500">#{issue.githubIssueNumber}</span>
        </div>
        <span className="text-[10px] text-zinc-500">{timeAgo(issue.fetchedAt)}</span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {issue.difficulty ? (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${difficultyColor[issue.difficulty]}`}
          >
            {difficultyText[issue.difficulty]}
          </span>
        ) : (
          <span className="rounded-full border border-zinc-800 bg-zinc-950/20 px-2.5 py-0.5 text-[9px] font-bold text-zinc-500">
            STARTER
          </span>
        )}
        {isClaimed && (
          <span className="rounded-full border border-purple-800/60 bg-purple-950/20 px-2.5 py-0.5 text-[9px] font-bold text-purple-300">
            CLAIMED
          </span>
        )}
        {issue.xpReward && (
          <span className="ml-auto text-xs font-bold text-[#00FF87]">+{issue.xpReward} XP</span>
        )}
      </div>

      {/* Title & Description */}
      <div className="space-y-2">
        <button
          onClick={() => onOpenDetail(issue)}
          className="text-left font-serif text-xl font-medium leading-snug text-white transition-colors hover:text-[#00FF87]"
        >
          {issue.title}
        </button>
        {issue.bodyExcerpt && (
          <p className="text-zinc-450 line-clamp-2 text-xs leading-relaxed">{issue.bodyExcerpt}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800/50 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[9px] font-bold text-zinc-400">
            MS
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Assigned Mentor
          </span>
        </div>

        <button
          onClick={() => onOpenDetail(issue)}
          className="flex items-center gap-1 text-[11px] font-bold text-[#00FF87] hover:underline"
        >
          View Issue <ArrowRight className="h-3 w-3" />
        </button>
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
  completedCount,
  currentUserLevel,
}: {
  initialData: IssuesPageResult;
  initialFilters: IssueFilter;
  repoOptions: RepoOption[];
  completedCount: number;
  currentUserLevel: number;
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
  const [sort, setSort] = useState<string>(initialFilters.sort ?? 'newest');
  const [category, setCategory] = useState<string>(initialFilters.category ?? 'all');

  // Drawer & Mobile menu states
  const [selectedIssue, setSelectedIssue] = useState<IssueWithStatus | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Sync state with filters
  useEffect(() => {
    setSearch(initialFilters.search ?? '');
    setState(initialFilters.state ?? 'open');
    setDifficulty(initialFilters.difficulty ?? '');
    setRepo(initialFilters.repo ?? '');
    setShowClaimed(initialFilters.showClaimed ?? false);
    setSort(initialFilters.sort ?? 'newest');
    setCategory(initialFilters.category ?? 'all');
  }, [initialFilters]);

  // Keep drawer details updated
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
        sort: string;
        category: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      const q = overrides.q !== undefined ? overrides.q : search;
      const st = overrides.state !== undefined ? overrides.state : state;
      const diff = overrides.difficulty !== undefined ? overrides.difficulty : difficulty;
      const r = overrides.repo !== undefined ? overrides.repo : repo;
      const sc = overrides.claimed !== undefined ? overrides.claimed : String(showClaimed);
      const srt = overrides.sort !== undefined ? overrides.sort : sort;
      const pg = overrides.page !== undefined ? overrides.page : '1';
      const cat = overrides.category !== undefined ? overrides.category : category;

      if (q) {
        params.set('q', q);
      } else {
        params.delete('q');
      }

      if (st && st !== 'open') {
        params.set('state', st);
      } else {
        params.delete('state');
      }

      if (diff) {
        params.set('difficulty', diff);
      } else {
        params.delete('difficulty');
      }

      if (r) {
        params.set('repo', r);
      } else {
        params.delete('repo');
      }

      if (sc === 'true') {
        params.set('claimed', 'true');
      } else {
        params.delete('claimed');
      }

      if (srt && srt !== 'newest') {
        params.set('sort', srt);
      } else {
        params.delete('sort');
      }

      if (cat && cat !== 'all') {
        params.set('category', cat);
      } else {
        params.delete('category');
      }

      if (pg && pg !== '1') {
        params.set('page', pg);
      } else {
        params.delete('page');
      }

      startTransition(() => {
        router.push(`/issues${params.size > 0 ? `?${params.toString()}` : ''}`);
      });
    },
    [router, searchParams, search, state, difficulty, repo, showClaimed, sort, category],
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

  const targetUnlock = completedCount < 3 ? 3 : completedCount < 7 ? 7 : 15;
  const nextLevelLabel = completedCount < 3 ? 'L1' : completedCount < 7 ? 'L2' : 'L3';

  // Toggle helpers for multi-select
  const handleDifficultyToggle = (diff: string) => {
    const activeDiffs = difficulty ? difficulty.split(',').filter(Boolean) : [];
    let nextDiffs: string[];
    if (activeDiffs.includes(diff)) {
      nextDiffs = activeDiffs.filter((d) => d !== diff);
    } else {
      nextDiffs = [...activeDiffs, diff];
    }
    const nextVal = nextDiffs.join(',');
    setDifficulty(nextVal);
    navigate({ difficulty: nextVal, page: '1' });
  };

  const handleRepoToggle = (repoValue: string) => {
    const activeRepos = repo ? repo.split(',').filter(Boolean) : repoOptions.map((o) => o.value);
    let nextRepos: string[];
    if (activeRepos.includes(repoValue)) {
      nextRepos = activeRepos.filter((r) => r !== repoValue);
    } else {
      nextRepos = [...activeRepos, repoValue];
    }
    const nextVal = nextRepos.length === repoOptions.length ? '' : nextRepos.join(',');
    setRepo(nextVal);
    navigate({ repo: nextVal, page: '1' });
  };

  // Reusable Sidebar content component
  const SidebarContent = () => (
    <div className="space-y-6">
      {/* Progress widget */}
      <div className="space-y-4 rounded-lg border border-zinc-800 bg-[#161b22]/20 p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            {completedCount < 3
              ? 'L0 Progress'
              : completedCount < 7
                ? 'L1 Progress'
                : completedCount < 15
                  ? 'L2 Progress'
                  : 'L3 Achieved'}
          </span>
          <span className="font-mono text-xs font-bold text-[#00FF87]">
            {completedCount >= 15
              ? `${completedCount} Solved`
              : `Solved ${completedCount}/${targetUnlock}`}
          </span>
        </div>
        {completedCount < 15 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-zinc-800/50 bg-zinc-950">
            <div
              className="h-full rounded-full bg-[#00FF87] shadow-[0_0_8px_rgba(0,255,135,0.4)] transition-all duration-500"
              style={{ width: `${(completedCount / targetUnlock) * 100}%` }}
            />
          </div>
        )}
        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {completedCount < 15
            ? `${targetUnlock - completedCount} issues away from ${nextLevelLabel} unlock`
            : 'All levels unlocked!'}
        </div>
      </div>

      {/* Segmented Status Switcher */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Issue Status
        </label>
        <div className="grid grid-cols-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-1">
          <button
            onClick={() => {
              setState('open');
              navigate({ state: 'open', page: '1' });
            }}
            className={`rounded py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
              state === 'open'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Open
          </button>
          <button
            onClick={() => {
              setState('closed');
              navigate({ state: 'closed', page: '1' });
            }}
            className={`rounded py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
              state === 'closed'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Closed
          </button>
        </div>
      </div>

      {/* Difficulty Filter */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Difficulty
        </label>
        <div className="flex flex-col gap-2">
          {[
            {
              value: 'E',
              label: 'EASY',
              color: 'border-emerald-800/60 text-emerald-400 bg-emerald-950/20',
            },
            {
              value: 'M',
              label: 'MEDIUM',
              color: 'border-amber-800/60 text-amber-400 bg-amber-950/20',
            },
            { value: 'H', label: 'HARD', color: 'border-red-800/60 text-red-400 bg-red-950/20' },
          ].map((opt) => {
            const activeDiffs = difficulty ? difficulty.split(',').filter(Boolean) : [];
            const isActive = activeDiffs.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => handleDifficultyToggle(opt.value)}
                className={`flex items-center justify-between rounded-md border px-4 py-2.5 font-mono text-xs font-bold tracking-wider transition-all ${
                  isActive
                    ? `${opt.color} shadow-sm`
                    : 'border-zinc-800 bg-[#161b22]/20 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                {isActive && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Repositories checklist */}
      {repoOptions.length > 0 && (
        <div className="space-y-2">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Repositories
          </label>
          <div className="max-h-60 space-y-2 divide-y divide-zinc-800/40 overflow-y-auto rounded-md border border-zinc-800 bg-[#161b22]/10 p-3">
            {repoOptions.map((opt) => {
              const activeRepos = repo
                ? repo.split(',').filter(Boolean)
                : repoOptions.map((o) => o.value);
              const isChecked = activeRepos.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-2.5 pt-2 text-xs text-zinc-300 transition-colors first:pt-0 hover:text-white"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleRepoToggle(opt.value)}
                    className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-[#00FF87] accent-[#00FF87] focus:outline-none focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="break-all font-mono">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Sort selection */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Sort By
        </label>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            navigate({ sort: e.target.value, page: '1' });
          }}
          className="w-full rounded border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-xs tracking-wider text-zinc-300 outline-none focus:border-zinc-700"
        >
          <option value="newest">NEWEST</option>
          <option value="xp_desc">HIGHEST XP</option>
          <option value="xp_asc">LOWEST XP</option>
        </select>
      </div>

      {/* Claimed toggle */}
      <div className="pt-2">
        <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-zinc-400 transition-colors hover:text-white">
          <input
            type="checkbox"
            checked={showClaimed}
            onChange={(e) => {
              setShowClaimed(e.target.checked);
              navigate({ claimed: String(e.target.checked), page: '1' });
            }}
            className="rounded border-zinc-800 bg-zinc-950 text-[#00FF87] accent-[#00FF87] focus:outline-none focus:ring-0 focus:ring-offset-0"
          />
          <span className="uppercase tracking-wider">Show Claimed Issues</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left/Center main stream (8 columns) */}
        <div className="space-y-6 lg:col-span-8">
          {actionError && (
            <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-3 text-[11px] uppercase tracking-widest text-red-400">
              {actionError}
            </div>
          )}

          {/* Search and Category chips */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="SEARCH ISSUES BY TITLE, LABELS, REPOS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && navigate({ q: search, page: '1' })}
                className="placeholder-zinc-650 w-full rounded-md border border-zinc-800 bg-[#161b22]/30 py-3 pl-11 pr-4 font-mono text-xs tracking-widest text-zinc-300 outline-none transition-all focus:border-zinc-700 focus:bg-[#161b22]/50"
              />
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {['all', 'bugs', 'docs', 'feature', 'tests'].map((cat) => {
                const isActive = category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategory(cat);
                      navigate({ category: cat, page: '1' });
                    }}
                    className={`rounded-full border px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                      isActive
                        ? 'border-[#00FF87] bg-[#00FF87]/10 text-[#00FF87] shadow-[0_0_12px_rgba(0,255,135,0.15)]'
                        : 'border-zinc-800 bg-transparent text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level Tabs Row */}
          <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-3 font-mono sm:flex-row sm:items-center">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              {['L0', 'L1', 'L2', 'L3'].map((tier) => {
                const tierReq: Record<string, number> = { L0: 0, L1: 3, L2: 7, L3: 15 };
                const isUnlocked = completedCount >= tierReq[tier]!;
                const diffMap: Record<string, string> = { L0: 'L0', L1: 'E', L2: 'M', L3: 'H' };
                const activeDiffs = difficulty.split(',').filter(Boolean);
                const isActive = activeDiffs.includes(diffMap[tier]!) && activeDiffs.length === 1;

                return (
                  <button
                    key={tier}
                    disabled={!isUnlocked}
                    onClick={() => {
                      const targetDiff = diffMap[tier]!;
                      setDifficulty(targetDiff);
                      navigate({ difficulty: targetDiff, page: '1' });
                    }}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-bold transition-all ${
                      !isUnlocked
                        ? 'cursor-not-allowed border-transparent text-zinc-600 opacity-40'
                        : isActive
                          ? 'border-[#00FF87] bg-[#00FF87]/5 font-black text-[#00FF87]'
                          : 'border-transparent text-zinc-400 hover:text-white'
                    }`}
                  >
                    {!isUnlocked && <Lock className="h-3 w-3 text-zinc-600" />}
                    {tier}
                  </button>
                );
              })}
            </div>

            {/* Right progress hint */}
            <div className="text-zinc-550 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
              {completedCount < 3 ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-[#00FF87]" />
                  <span>Solve {3 - completedCount} more to unlock L1</span>
                </>
              ) : completedCount < 7 ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-[#00FF87]" />
                  <span>Solve {7 - completedCount} more to unlock L2</span>
                </>
              ) : completedCount < 15 ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-[#00FF87]" />
                  <span>Solve {15 - completedCount} more to unlock L3</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-[#00FF87]" />
                  <span>All levels unlocked!</span>
                </>
              )}
            </div>
          </div>

          {/* Mobile Filter Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileFiltersOpen(true)}
              className="flex w-full items-center justify-center gap-2 border border-zinc-800 bg-[#161b22]/30 px-4 py-2.5 text-xs text-zinc-300 transition-colors hover:bg-[#161b22]/50 hover:text-white"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#00FF87]" />
              Filter & Sort
            </button>
          </div>

          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
            {isPending ? 'LOADING...' : `${initialData.total} ISSUES`}
          </div>

          {/* Cards Stream */}
          <div className={isPending ? 'opacity-50 transition-opacity' : ''}>
            {initialData.issues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 py-16 text-center text-xs uppercase tracking-widest text-zinc-600">
                No issues found.
              </div>
            ) : (
              <div className="space-y-4">
                {initialData.issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onClaim={handleClaim}
                    onUnclaim={handleUnclaim}
                    actionPending={actionIssueId === issue.id}
                    onOpenDetail={setSelectedIssue}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-between border-t border-zinc-800 pt-6 font-mono">
              <button
                disabled={currentPage <= 1}
                onClick={() => navigate({ page: String(currentPage - 1) })}
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> PREV
              </button>
              <span className="text-[11px] uppercase tracking-widest text-zinc-500">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => navigate({ page: String(currentPage + 1) })}
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                NEXT <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Filtering Sidebar (4 columns, visible only on lg screens) */}
        <div className="hidden space-y-6 lg:col-span-4 lg:block">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Drawer (Backdrop + Slideout Panel) */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileFiltersOpen(false)}
          />

          {/* Slide-out drawer */}
          <div className="relative flex h-full w-80 max-w-full animate-slide-in flex-col border-l border-zinc-800 bg-[#0D0E12] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-6">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                Filters & Sorting
              </h2>
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="text-zinc-550 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
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
