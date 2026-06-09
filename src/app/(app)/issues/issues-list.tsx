'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import {
  ArrowRight,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  GitPullRequest,
  LayoutDashboard,
  Lock,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareCode,
  X,
} from 'lucide-react';
import {
  claimIssue,
  unclaimIssue,
  type IssueFilter,
  type IssuesPageResult,
  type IssueWithStatus,
  type RepoOption,
} from '@/app/actions/issues';

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Bugs', value: 'bugs' },
  { label: 'Docs', value: 'docs' },
  { label: 'Feature', value: 'feature' },
  { label: 'Tests', value: 'tests' },
];

const DIFFICULTIES = [
  { label: 'EASY', value: 'E', className: 'border-emerald-400 bg-[#00FF87] text-black' },
  { label: 'MEDIUM', value: 'M', className: 'border-yellow-300 bg-yellow-300 text-black' },
  { label: 'HARD', value: 'H', className: 'border-red-300 bg-red-300/50 text-red-950' },
];

const LEVELS = [
  { label: 'L0', difficulty: '', requiredLevel: 0 },
  { label: 'L1', difficulty: 'E', requiredLevel: 0 },
  { label: 'L2', difficulty: 'M', requiredLevel: 2 },
  { label: 'L3', difficulty: 'H', requiredLevel: 3 },
];

const SYSTEM_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Repositories', icon: SquareCode },
  { label: 'Issues', icon: CheckSquare, active: true },
  { label: 'Pull Requests', icon: GitPullRequest },
  { label: 'Pipelines', icon: SlidersHorizontal },
  { label: 'Security', icon: ShieldCheck },
];

function parseList(value?: string) {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function truncateExcerpt(issue: IssueWithStatus) {
  if (issue.bodyExcerpt?.trim()) return issue.bodyExcerpt.trim();
  const labels = issue.labels?.slice(0, 3).join(', ');
  return labels
    ? `Tagged with ${labels}. Open the issue to inspect scope, context, and acceptance details.`
    : 'Open the issue to inspect scope, context, and acceptance details before claiming.';
}

function IssueCard({
  issue,
  onClaim,
  onUnclaim,
  actionPending,
}: {
  issue: IssueWithStatus;
  onClaim: (id: number) => void;
  onUnclaim: (recId: number) => void;
  actionPending: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isClaimed = issue.userRecStatus === 'claimed';
  const difficulty = DIFFICULTIES.find((item) => item.value === issue.difficulty);
  const mentorInitials = (issue.repoFullName.split('/')[0] ?? 'MS').slice(0, 2).toUpperCase();

  async function handleCopy() {
    await navigator.clipboard.writeText(issue.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article className="rounded-md border border-zinc-800 bg-[#111418]/85 p-5 shadow-[0_0_0_1px_rgba(0,255,135,0.03)] transition-colors hover:border-zinc-700">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-zinc-300">
          <SquareCode className="h-4 w-4 text-zinc-400" />
          <span className="break-all font-mono">{issue.repoFullName}</span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-zinc-400">#{issue.githubIssueNumber}</span>
        </div>
        {difficulty && (
          <span
            className={`shrink-0 rounded-sm border px-3 py-1 text-[12px] font-bold ${difficulty.className}`}
          >
            {difficulty.label}
          </span>
        )}
      </div>

      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-2xl font-bold leading-snug text-white transition-colors hover:text-[#00FF87]"
      >
        {issue.title}
      </a>

      <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-zinc-300">{truncateExcerpt(issue)}</p>

      {issue.labels && issue.labels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {issue.labels.slice(0, 5).map((label) => (
            <span
              key={label}
              className="rounded-sm border border-zinc-800 bg-black/20 px-2 py-1 text-[11px] text-zinc-400"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-5">
        <span className="flex items-center gap-2 text-[12px] text-zinc-400">
          <Clock3 className="h-4 w-4" />
          {timeAgo(issue.fetchedAt)}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[11px] text-zinc-200">
          {mentorInitials}
        </span>
        {issue.xpReward && (
          <span className="rounded-sm border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] text-[#00FF87]">
            +{issue.xpReward} XP
          </span>
        )}
        {isClaimed && (
          <button
            onClick={() => issue.userRecId && onUnclaim(issue.userRecId)}
            disabled={actionPending || !issue.userRecId}
            className="rounded-sm border border-zinc-700 px-3 py-2 text-[11px] text-zinc-400 transition-colors hover:border-red-500/60 hover:text-red-300 disabled:opacity-40"
          >
            {actionPending ? '...' : 'UNCLAIM'}
          </button>
        )}
        {!isClaimed && (
          <button
            onClick={() => onClaim(issue.id)}
            disabled={actionPending}
            className="rounded-sm border border-zinc-700 px-3 py-2 text-[11px] text-zinc-300 transition-colors hover:border-[#00FF87] hover:text-[#00FF87] disabled:opacity-40"
          >
            {actionPending ? 'CLAIMING...' : 'CLAIM'}
          </button>
        )}
        <button
          onClick={handleCopy}
          className="rounded-sm border border-zinc-800 p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
          title="Copy issue URL"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-2 rounded-sm border border-[#00FF87] px-4 py-2 text-[13px] font-bold text-[#00FF87] transition-colors hover:bg-[#00FF87] hover:text-black"
        >
          View Issue <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function FilterPanel({
  repoOptions,
  selectedRepos,
  selectedDifficulties,
  state,
  solvedIssues,
  onRepoToggle,
  onDifficultyToggle,
  onStateChange,
  onClear,
}: {
  repoOptions: RepoOption[];
  selectedRepos: string[];
  selectedDifficulties: string[];
  state: 'open' | 'closed';
  solvedIssues: number;
  onRepoToggle: (repo: string) => void;
  onDifficultyToggle: (difficulty: string) => void;
  onStateChange: (state: 'open' | 'closed') => void;
  onClear: () => void;
}) {
  const progressGoal = 7;
  const progress = Math.min(100, Math.round((solvedIssues / progressGoal) * 100));
  const remaining = Math.max(0, progressGoal - solvedIssues);

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-[#00FF87]/35 bg-[#00FF87]/[0.04] p-5 shadow-[inset_-40px_0_80px_rgba(0,255,135,0.05)]">
        <div className="mb-8 flex items-center gap-3 text-sm font-bold text-zinc-100">
          <Sparkles className="h-4 w-4 text-[#00FF87]" />
          L1 Progress
        </div>
        <div className="mb-3 flex items-end justify-between">
          <span className="text-[12px] text-zinc-300">Solved</span>
          <span className="text-3xl font-black text-white">
            {solvedIssues}
            <span className="text-base text-zinc-400">/{progressGoal}</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-700">
          <div className="h-full rounded-full bg-[#00FF87]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 inline-flex bg-emerald-500/10 px-2 py-1 text-[12px] text-[#00FF87]">
          {remaining} issues away from L2 unlock
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <Filter className="h-4 w-4" />
            Refine Feed
          </h2>
          <button onClick={onClear} className="text-[12px] text-zinc-500 hover:text-[#00FF87]">
            Clear
          </button>
        </div>

        <div className="mb-8">
          <div className="mb-4 text-[12px] uppercase tracking-widest text-zinc-500">Repositories</div>
          <div className="space-y-3">
            {repoOptions.length === 0 ? (
              <p className="text-sm text-zinc-500">No repositories connected yet.</p>
            ) : (
              repoOptions.map((repo) => {
                const checked = selectedRepos.length === 0 || selectedRepos.includes(repo.value);
                return (
                  <label key={repo.value} className="flex cursor-pointer items-center gap-3 text-zinc-300">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onRepoToggle(repo.value)}
                      className="h-5 w-5 rounded-sm accent-[#00FF87]"
                    />
                    <span className="break-all text-sm">{repo.value}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4 text-[12px] uppercase tracking-widest text-zinc-500">Difficulty</div>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((difficulty) => {
              const active =
                selectedDifficulties.length === 0 || selectedDifficulties.includes(difficulty.value);
              return (
                <button
                  key={difficulty.value}
                  onClick={() => onDifficultyToggle(difficulty.value)}
                  className={`rounded-sm border px-4 py-2 text-[13px] font-bold transition-opacity ${
                    active ? difficulty.className : 'border-zinc-800 bg-transparent text-zinc-500'
                  }`}
                >
                  {difficulty.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-4 text-[12px] uppercase tracking-widest text-zinc-500">Status</div>
          <div className="grid grid-cols-2 rounded-md border border-zinc-700 bg-zinc-800 p-1">
            {(['open', 'closed'] as const).map((item) => (
              <button
                key={item}
                onClick={() => onStateChange(item)}
                className={`rounded-sm px-4 py-2 text-sm capitalize ${
                  state === item ? 'bg-zinc-100 text-black' : 'text-zinc-400'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function IssuesList({
  initialData,
  initialFilters,
  repoOptions,
  currentUserLevel,
  solvedIssues,
}: {
  initialData: IssuesPageResult;
  initialFilters: IssueFilter;
  repoOptions: RepoOption[];
  currentUserLevel: number;
  solvedIssues: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [actionIssueId, setActionIssueId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(initialFilters.search ?? '');

  const state = initialFilters.state ?? 'open';
  const selectedRepos = parseList(initialFilters.repo);
  const selectedDifficulties = parseList(initialFilters.difficulty);
  const selectedCategory = initialFilters.category ?? '';
  const currentPage = initialData.page;
  const totalPages = Math.ceil(initialData.total / initialData.pageSize);
  const unlockRemaining = Math.max(0, 7 - solvedIssues);

  const activeLevel = useMemo(() => {
    const diff = selectedDifficulties.length === 1 ? selectedDifficulties[0] : '';
    return LEVELS.find((level) => level.difficulty === diff)?.label ?? 'L0';
  }, [selectedDifficulties]);

  const navigate = useCallback(
    (
      overrides: Partial<{
        q: string;
        state: string;
        difficulty: string;
        repo: string;
        category: string;
        claimed: string;
        page: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      const values = {
        q: overrides.q ?? search,
        state: overrides.state ?? state,
        difficulty: overrides.difficulty ?? selectedDifficulties.join(','),
        repo: overrides.repo ?? selectedRepos.join(','),
        category: overrides.category ?? selectedCategory,
        page: overrides.page ?? '1',
      };

      if (values.q) params.set('q', values.q);
      else params.delete('q');
      if (values.state !== 'open') params.set('state', values.state);
      else params.delete('state');
      if (values.difficulty) params.set('difficulty', values.difficulty);
      else params.delete('difficulty');
      if (values.repo) params.set('repo', values.repo);
      else params.delete('repo');
      if (values.category) params.set('category', values.category);
      else params.delete('category');
      if (values.page !== '1') params.set('page', values.page);
      else params.delete('page');

      startTransition(() => {
        router.push(`/issues${params.size > 0 ? `?${params.toString()}` : ''}`);
      });
    },
    [router, search, searchParams, selectedCategory, selectedDifficulties, selectedRepos, state],
  );

  async function handleClaim(issueId: number) {
    setActionIssueId(issueId);
    setActionError(null);
    const result = await claimIssue(issueId);
    setActionIssueId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function handleUnclaim(recId: number, issueId: number) {
    setActionIssueId(issueId);
    setActionError(null);
    const result = await unclaimIssue(recId);
    setActionIssueId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    router.refresh();
  }

  function handleRepoToggle(repo: string) {
    const allRepos = repoOptions.map((option) => option.value);
    const current = selectedRepos.length === 0 ? allRepos : selectedRepos;
    const next = toggleValue(current, repo);
    navigate({ repo: next.length === allRepos.length ? '' : next.join(','), page: '1' });
  }

  function handleDifficultyToggle(difficulty: string) {
    const allDifficulties = DIFFICULTIES.map((item) => item.value);
    const current = selectedDifficulties.length === 0 ? allDifficulties : selectedDifficulties;
    const next = toggleValue(current, difficulty);
    navigate({
      difficulty: next.length === allDifficulties.length ? '' : next.join(','),
      page: '1',
    });
  }

  const panel = (
    <FilterPanel
      repoOptions={repoOptions}
      selectedRepos={selectedRepos}
      selectedDifficulties={selectedDifficulties}
      state={state}
      solvedIssues={solvedIssues}
      onRepoToggle={handleRepoToggle}
      onDifficultyToggle={handleDifficultyToggle}
      onStateChange={(nextState) => navigate({ state: nextState, page: '1' })}
      onClear={() => {
        setSearch('');
        navigate({ q: '', repo: '', difficulty: '', category: '', state: 'open', page: '1' });
      }}
    />
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)_300px]">
      <aside className="hidden border-r border-zinc-800 pr-6 xl:block">
        <div className="sticky top-8">
          <h2 className="text-3xl font-black text-white">System</h2>
          <p className="mt-2 text-[12px] text-zinc-400">v2.4.0-stable</p>
          <nav className="mt-12 space-y-2">
            {SYSTEM_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-4 rounded-sm px-3 py-3 text-sm ${
                    item.active
                      ? 'border-l-2 border-[#00FF87] bg-zinc-800/80 text-white'
                      : 'text-zinc-400'
                  }`}
                >
                  <Icon className={item.active ? 'h-5 w-5 text-[#00FF87]' : 'h-5 w-5'} />
                  {item.label}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">Issues</h1>
            <span className="rounded-sm border border-[#00FF87] px-3 py-2 text-sm font-bold text-[#00FF87]">
              {initialData.total} {state}
            </span>
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex items-center gap-2 rounded-sm border border-zinc-700 px-4 py-2 text-sm text-zinc-200 xl:hidden"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </header>

        <div className="mb-8 rounded-md border border-zinc-700 bg-[#121519]/80 p-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search issues, labels, or repositories..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && navigate({ q: search, page: '1' })}
              className="w-full rounded-sm border border-zinc-700 bg-black/30 py-4 pl-12 pr-4 text-base text-white outline-none placeholder:text-zinc-600 focus:border-[#00FF87]"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {CATEGORIES.map((category) => (
              <button
                key={category.label}
                onClick={() => navigate({ category: category.value, page: '1' })}
                className={`rounded-sm border px-4 py-2 text-sm font-medium ${
                  selectedCategory === category.value
                    ? 'border-[#00FF87] bg-[#00FF87] text-black'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-md border border-zinc-700 bg-[#121519]/80 p-3">
          {LEVELS.map((level) => {
            const locked = currentUserLevel < level.requiredLevel;
            const active = activeLevel === level.label;
            return (
              <button
                key={level.label}
                disabled={locked}
                onClick={() => navigate({ difficulty: level.difficulty, page: '1' })}
                className={`flex min-w-20 items-center justify-center gap-2 rounded-sm border px-4 py-2 text-sm font-bold ${
                  active
                    ? 'border-[#00FF87] bg-[#00FF87]/10 text-[#00FF87]'
                    : 'border-transparent text-zinc-400'
                } disabled:cursor-not-allowed disabled:opacity-35`}
              >
                {locked ? <Lock className="h-4 w-4" /> : <Lock className="h-4 w-4 text-[#00FF87]" />}
                {level.label}
              </button>
            );
          })}
          <span className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <ExternalLink className="h-4 w-4" />
            Solve {unlockRemaining} more to unlock L2
          </span>
        </div>

        {actionError && (
          <div className="mb-6 rounded-sm border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        )}

        <div className={isPending ? 'space-y-5 opacity-50 transition-opacity' : 'space-y-5'}>
          {initialData.issues.length === 0 ? (
            <div className="rounded-md border border-zinc-800 bg-[#111418]/85 py-16 text-center text-zinc-500">
              No issues found for this filter set.
            </div>
          ) : (
            initialData.issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClaim={handleClaim}
                onUnclaim={(recId) => handleUnclaim(recId, issue.id)}
                actionPending={actionIssueId === issue.id}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-6">
            <button
              disabled={currentPage <= 1}
              onClick={() => navigate({ page: String(currentPage - 1) })}
              className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-[#00FF87] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm text-zinc-500">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => navigate({ page: String(currentPage + 1) })}
              className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-[#00FF87] disabled:opacity-30"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <aside className="hidden border-l border-zinc-800 pl-6 xl:block">
        <div className="sticky top-8">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-white">Context</h2>
            <p className="mt-3 flex items-center gap-2 text-[12px] text-zinc-300">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00FF87]" />
              Active Session
            </p>
          </div>
          {panel}
        </div>
      </aside>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            className="absolute inset-0 bg-black/70"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-zinc-800 bg-[#0D0E12] p-6 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Filters</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                className="rounded-sm border border-zinc-700 p-2 text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}
