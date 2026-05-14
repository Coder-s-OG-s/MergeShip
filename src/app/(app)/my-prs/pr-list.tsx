'use client';

import { useState } from 'react';
import type { GitHubPR } from '@/app/actions/github-sync';

type PRTab = 'all' | 'pending_review' | 'mentor_approved' | 'merged' | 'closed';

type EnrichedPR = GitHubPR & {
  mentor_status?: 'pending' | 'approved' | null;
  reviewed_by?: string | null;
  mentor_level?: string | null;
  close_reason?: string | null;
  xp_earned?: number | null;
};

type Props = {
  prs: EnrichedPR[];
};

const TABS: { key: PRTab; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'pending_review', label: 'PENDING REVIEW' },
  { key: 'mentor_approved', label: 'MENTOR APPROVED' },
  { key: 'merged', label: 'MERGED' },
  { key: 'closed', label: 'CLOSED' },
];

export function PRList({ prs }: Props) {
  const [activeTab, setActiveTab] = useState<PRTab>('all');
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  // Derive unique sorted repo list from all PRs
  const repoOptions = Array.from(new Set(prs.map((pr) => pr.repo_full_name))).sort();

  // Apply repo filter first, then tab filter
  const repoFiltered = selectedRepo ? prs.filter((pr) => pr.repo_full_name === selectedRepo) : prs;

  const tabFiltered = repoFiltered.filter((pr) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'merged') return pr.state === 'merged';
    if (activeTab === 'closed') return pr.state === 'closed';
    if (activeTab === 'pending_review')
      return pr.state === 'open' && pr.mentor_status === 'pending';
    if (activeTab === 'mentor_approved') return pr.mentor_status === 'approved';
    return true;
  });

  // Tab counts respect the active repo filter
  const counts: Record<PRTab, number> = {
    all: repoFiltered.length,
    pending_review: repoFiltered.filter((p) => p.state === 'open' && p.mentor_status === 'pending')
      .length,
    mentor_approved: repoFiltered.filter((p) => p.mentor_status === 'approved').length,
    merged: repoFiltered.filter((p) => p.state === 'merged').length,
    closed: repoFiltered.filter((p) => p.state === 'closed').length,
  };

  return (
    <div>
      {/* Tabs + Repo dropdown row */}
      <div className="flex items-end justify-between gap-4 border-b border-[#2d333b]">
        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-5 py-3 text-[12px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === tab.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`ml-1.5 text-[10px] ${
                    activeTab === tab.key ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#39d353]" />
              )}
            </button>
          ))}
        </div>

        {/* Repo dropdown */}
        {repoOptions.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <svg
              className="h-3 w-3 shrink-0 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7h18M6 12h12M9 17h6"
              />
            </svg>
            <select
              value={selectedRepo}
              onChange={(e) => {
                setSelectedRepo(e.target.value);
                setActiveTab('all');
              }}
              className="cursor-pointer border border-[#2d333b] bg-[#1c2128] px-3 py-1.5 text-[11px] uppercase tracking-widest text-zinc-300 outline-none transition-colors hover:border-zinc-600 focus:border-zinc-500"
            >
              <option value="">All Repos</option>
              {repoOptions.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
            {selectedRepo && (
              <button
                onClick={() => setSelectedRepo('')}
                className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300"
                title="Clear filter"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Result count */}
      <div className="mb-3 mt-3 text-[11px] uppercase tracking-widest text-zinc-600">
        {tabFiltered.length} pull request{tabFiltered.length !== 1 ? 's' : ''}
        {selectedRepo && <span className="ml-2 text-[#39d353]/70">in {selectedRepo}</span>}
      </div>

      {/* PR Cards */}
      <div className="space-y-3">
        {tabFiltered.length === 0 ? (
          <div className="py-16 text-center text-[12px] uppercase tracking-widest text-zinc-600">
            No pull requests found
          </div>
        ) : (
          tabFiltered.map((pr) => <PRCard key={pr.id} pr={pr} />)
        )}
      </div>
    </div>
  );
}

function PRCard({ pr }: { pr: EnrichedPR }) {
  const statusInfo = getPRStatusInfo(pr);

  return (
    <div className="rounded-sm border border-[#2d333b] bg-[#161b22] p-5 transition-all hover:border-[#3d4450]">
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Repo icon */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-[#2d333b] bg-[#1c2128]">
            <svg className="h-3 w-3 text-zinc-400" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </div>
          <span className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">
            {pr.repo_full_name}
          </span>
          <StatusBadge pr={pr} statusInfo={statusInfo} />
        </div>

        {/* Action button */}
        <ActionButton pr={pr} statusInfo={statusInfo} />
      </div>

      {/* PR Title */}
      <a
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-3 block font-mono text-[15px] font-medium text-white transition-colors hover:text-[#39d353]"
      >
        {pr.title} <span className="text-zinc-500">#{pr.number}</span>
      </a>

      {/* Bottom meta */}
      <div className="flex items-center gap-5 text-[11px] text-zinc-500">
        <PRMeta pr={pr} />
      </div>
    </div>
  );
}

type StatusInfo = {
  type: 'pending_review' | 'submitted' | 'merged' | 'closed' | 'open';
};

function getPRStatusInfo(pr: EnrichedPR): StatusInfo {
  if (pr.state === 'merged') return { type: 'merged' };
  if (pr.state === 'closed') return { type: 'closed' };
  if (pr.mentor_status === 'approved') return { type: 'submitted' };
  if (pr.mentor_status === 'pending') return { type: 'pending_review' };
  return { type: 'open' };
}

function StatusBadge({ pr, statusInfo }: { pr: EnrichedPR; statusInfo: StatusInfo }) {
  switch (statusInfo.type) {
    case 'pending_review':
      return (
        <span className="rounded-sm border border-amber-600/60 bg-amber-900/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
          Mentor Review Pending
        </span>
      );
    case 'submitted':
      return (
        <span className="rounded-sm border border-[#39d353]/50 bg-[#39d353]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#39d353]">
          Submitted to Maintainer
        </span>
      );
    case 'merged':
      return (
        <span className="rounded-sm border border-[#8957e5]/60 bg-[#8957e5]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a855f7]">
          Merged
        </span>
      );
    case 'closed':
      return (
        <span className="rounded-sm border border-zinc-600/60 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Closed by Maintainer
        </span>
      );
    default:
      return (
        <span className="rounded-sm border border-blue-600/60 bg-blue-900/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
          Open
        </span>
      );
  }
  pr; // used for type narrowing
}

function ActionButton({ pr, statusInfo }: { pr: EnrichedPR; statusInfo: StatusInfo }) {
  const base =
    'shrink-0 rounded-sm border px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all';

  switch (statusInfo.type) {
    case 'pending_review':
      return (
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-[#2d333b] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800`}
        >
          View Draft
        </a>
      );
    case 'submitted':
      return (
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-[#39d353]/60 bg-[#39d353]/10 text-[#39d353] hover:bg-[#39d353]/20`}
        >
          Track on GitHub
        </a>
      );
    case 'merged':
      return (
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-[#2d333b] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800`}
        >
          View PR
        </a>
      );
    case 'closed':
      return (
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-[#2d333b] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800`}
        >
          View Feedback
        </a>
      );
    default:
      return (
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-[#2d333b] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800`}
        >
          View PR
        </a>
      );
  }
}

function PRMeta({ pr }: { pr: EnrichedPR }) {
  const timeAgo = formatRelativeTime(pr.github_created_at);

  return (
    <>
      {/* Clock icon + meta */}
      <span className="flex items-center gap-1.5">
        <svg
          className="h-3 w-3 text-zinc-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
        </svg>
        {pr.reviewed_by ? (
          <>
            <span className="text-zinc-500">
              Sent to @{pr.reviewed_by}
              {pr.mentor_level ? ` (${pr.mentor_level})` : ''}
            </span>
          </>
        ) : pr.close_reason ? (
          <span className="text-zinc-500">Reason: {pr.close_reason}</span>
        ) : pr.xp_earned ? (
          <span className="text-[#39d353]">+{pr.xp_earned} XP earned</span>
        ) : null}
      </span>

      {/* Updated time */}
      <span className="flex items-center gap-1">
        <span className="text-zinc-600">Updated</span>
        <span>{timeAgo}</span>
      </span>

      {/* XP badge for merged */}
      {pr.state === 'merged' && pr.xp_earned && (
        <span className="flex items-center gap-1 text-[#39d353]">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 2a6 6 0 110 12A6 6 0 018 2zm0 1a5 5 0 100 10A5 5 0 008 3zm.5 2.5v2h2a.5.5 0 010 1h-2v2a.5.5 0 01-1 0v-2h-2a.5.5 0 010-1h2v-2a.5.5 0 011 0z" />
          </svg>
          +{pr.xp_earned} XP earned
        </span>
      )}
    </>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
