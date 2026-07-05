'use client';

import React, { useState } from 'react';
import type { ContributorListRow } from '@/app/actions/maintainer';
import { ContributorActionsMenu } from './contributor-actions-menu';

export function ContributorsTable({
  installationId,
  isOrganization,
  initialContributors,
}: {
  installationId: number;
  isOrganization: boolean;
  initialContributors: ContributorListRow[];
}) {
  const [contributors, setContributors] = useState(initialContributors);

  function handleRemoved(userId: string) {
    setContributors((prev) => prev.filter((c) => c.userId !== userId));
  }

  return (
    <div className="mt-8 overflow-hidden rounded-md border border-[#2d333b]">
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
          {contributors.map((c) => (
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
                  {c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleDateString() : '—'}
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
          {contributors.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                No contributors yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
