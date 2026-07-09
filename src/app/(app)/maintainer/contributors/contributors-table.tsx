'use client';

import React, { useState, useMemo } from 'react';
import type { ContributorListRow } from '@/app/actions/maintainer';
import { ContributorActionsMenu } from './contributor-actions-menu';

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const diff = Math.max(0, Date.now() - date.getTime());

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes || 1}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

type SortKey = 'trustScore' | 'lastActiveAt' | 'mergedPrs' | 'level' | 'xp';

export function ContributorsTable({
  installationId,
  isOrganization,
  initialContributors,
  repos,
}: {
  installationId: number;
  isOrganization: boolean;
  initialContributors: ContributorListRow[];
  repos: string[];
}) {
  const [contributors, setContributors] = useState(initialContributors);

  const [activeLevel, setActiveLevel] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('All repos');
  const [sortKey, setSortKey] = useState<SortKey>('trustScore');

  function handleRemoved(userId: string) {
    setContributors((prev) => prev.filter((c) => c.userId !== userId));
  }

  const levelCounts = useMemo(() => {
    return {
      All: contributors.length,
      L0: contributors.filter((c) => c.level === 0).length,
      L1: contributors.filter((c) => c.level === 1).length,
      L2: contributors.filter((c) => c.level === 2).length,
      L3: contributors.filter((c) => c.level === 3).length,
    };
  }, [contributors]);

  const filteredAndSorted = useMemo(() => {
    let list = contributors;

    // Level filter
    if (activeLevel !== 'All') {
      const levelNum = parseInt(activeLevel.replace('L', ''), 10);
      list = list.filter((c) => c.level === levelNum);
    }

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.handle.toLowerCase().includes(q));
    }

    // Repo filter
    if (selectedRepo !== 'All repos') {
      list = list.filter((c) => c.repoFullNames.includes(selectedRepo));
    }

    // Sort
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (sortKey === 'lastActiveAt') {
        const aTime = aVal ? new Date(aVal as string).getTime() : 0;
        const bTime = bVal ? new Date(bVal as string).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
      } else {
        if (aVal !== bVal) return (bVal as number) - (aVal as number);
      }

      return a.handle.localeCompare(b.handle);
    });

    return list;
  }, [contributors, activeLevel, searchQuery, selectedRepo, sortKey]);

  return (
    <div className="mt-8 space-y-4">
      {/* Level Tabs */}
      <div className="flex gap-4 border-b border-[#2d333b]">
        {(['All', 'L0', 'L1', 'L2', 'L3'] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setActiveLevel(lvl)}
            className={`px-1 pb-2 text-sm ${activeLevel === lvl ? 'border-b-2 border-emerald-500 font-medium text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {lvl} ·{' '}
            <span className={activeLevel === lvl ? 'text-zinc-400' : 'text-zinc-600'}>
              {levelCounts[lvl as keyof typeof levelCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Filter contributors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-[#2d333b] bg-[#161b22] px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        />
        <select
          value={selectedRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          className="rounded-md border border-[#2d333b] bg-[#161b22] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        >
          <option value="All repos">All repos</option>
          {repos.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-[#2d333b] bg-[#161b22] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        >
          <option value="trustScore">Trust Score</option>
          <option value="lastActiveAt">Last Active</option>
          <option value="mergedPrs">PRs Merged</option>
          <option value="level">Level</option>
          <option value="xp">XP</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-md border border-[#2d333b]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#161b22] text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Handle</th>
              <th className="px-4 py-3">Trust</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">XP</th>
              <th className="px-4 py-3">Merged PRs</th>
              <th className="px-4 py-3">In Review</th>
              <th className="px-4 py-3">Issues Solved</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((c) => (
              <React.Fragment key={c.userId}>
                <tr className="border-t border-[#2d333b]">
                  <td className="px-4 py-3 text-zinc-200">{c.handle}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right font-medium">{c.trustScore}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full ${
                            c.trustScore >= 80
                              ? 'bg-emerald-500'
                              : c.trustScore >= 40
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          }`}
                          style={{ width: `${c.trustScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.level}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.xp}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.mergedPrs}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.inReview}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.issuesSolved}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {c.lastActiveAt ? getRelativeTime(c.lastActiveAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ContributorActionsMenu
                      installationId={installationId}
                      userId={c.userId}
                      handle={c.handle}
                      isOrganization={isOrganization}
                      onRemoved={handleRemoved}
                    />
                  </td>
                </tr>
                {c.trustScore < 40 && c.aiFlaggedPrCount > 0 && (
                  <tr className="bg-amber-950/15 text-xs text-amber-400/90">
                    <td colSpan={9} className="border-t border-[#2d333b]/40 px-4 py-2">
                      <span className="font-medium text-amber-400">⚠ Low trust score</span> —{' '}
                      {c.aiFlaggedPrCount} AI-flagged PR{c.aiFlaggedPrCount > 1 ? 's' : ''}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  No contributors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
