'use client';

import { useState } from 'react';
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
            <tr key={c.userId} className="border-t border-[#2d333b]">
              <td className="px-4 py-3 text-zinc-200">{c.handle}</td>
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
          ))}
          {contributors.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                No contributors yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
