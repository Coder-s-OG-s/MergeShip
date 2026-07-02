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
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-bold">Contributors</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Contributors active across <span className="text-zinc-300">{install.accountLogin}</span>{' '}
          repos.
        </p>

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
                </tr>
              ))}
              {contributors.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No contributors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
