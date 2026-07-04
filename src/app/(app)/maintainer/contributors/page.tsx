import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getContributorsList,
  type ContributorListRow,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';

import { LevelDistributionPanel } from './level-distribution-panel';

export const dynamic = 'force-dynamic';

export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ install?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sb = await getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  const installs: MaintainerInstall[] = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) redirect('/maintainer');

  const installId =
    resolvedSearchParams.install &&
    installs.find((i) => i.installationId === Number(resolvedSearchParams.install))
      ? Number(resolvedSearchParams.install)
      : installs[0]!.installationId;

  const contributorsRes = await getContributorsList(installId);
  const contributors: ContributorListRow[] = isOk(contributorsRes) ? contributorsRes.data : [];
  const install = installs.find((i) => i.installationId === installId)!;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-bold">Contributors</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Contributors active across <span className="text-zinc-300">{install.accountLogin}</span>{' '}
          repos.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="h-fit overflow-hidden rounded-md border border-[#2d333b] lg:col-span-3">
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
                    </tr>
                    {c.trustScore < 40 && c.aiFlaggedPrCount > 0 && (
                      <tr className="bg-amber-950/15 text-xs text-amber-400/90">
                        <td colSpan={8} className="border-t border-[#2d333b]/40 px-4 py-2">
                          <span className="font-medium text-amber-400">⚠ Low trust score</span> —{' '}
                          {c.aiFlaggedPrCount} AI-flagged PR{c.aiFlaggedPrCount > 1 ? 's' : ''}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
          <div className="lg:col-span-1">
            <LevelDistributionPanel contributors={contributors} />
          </div>
        </div>
      </div>
    </div>
  );
}
