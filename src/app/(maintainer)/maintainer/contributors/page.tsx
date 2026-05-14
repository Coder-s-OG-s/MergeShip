import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getMaintainerContributors,
  type ContributorRow,
} from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

function levelBadge(level: number): string {
  if (level === 0) return 'bg-zinc-800 text-zinc-400';
  if (level === 1) return 'bg-blue-900/40 text-blue-300';
  if (level === 2) return 'bg-cyan-900/40 text-cyan-300';
  return 'bg-purple-900/40 text-purple-300';
}

export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: { install?: string; page?: string };
}) {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  if (!isOk(installsRes) || installsRes.data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        No GitHub App installations found.
      </div>
    );
  }

  const installs = installsRes.data;
  const installationId =
    searchParams.install && installs.find((i) => i.installationId === Number(searchParams.install))
      ? Number(searchParams.install)
      : installs[0]!.installationId;

  const page = Math.max(0, Number(searchParams.page ?? 0));
  const contribRes = await getMaintainerContributors({ installationId, page });
  const rows: ContributorRow[] = isOk(contribRes) ? contribRes.data.rows : [];
  const hasMore = isOk(contribRes) ? contribRes.data.hasMore : false;

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contributors</h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
            Contributor Management
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#30363d] bg-[#161b22]">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-zinc-500">No contributors found.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#30363d] text-[10px] uppercase tracking-widest text-[#8b949e]">
                <th className="px-5 py-3 text-left font-medium">Contributor</th>
                <th className="px-5 py-3 text-left font-medium">Level</th>
                <th className="px-5 py-3 text-left font-medium">XP</th>
                <th className="px-5 py-3 text-left font-medium">Merged PRs</th>
                <th className="px-5 py-3 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]/40">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[#0d1117]/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white">
                        {row.handle.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-white">@{row.handle}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${levelBadge(row.level)}`}
                    >
                      L{row.level}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#8b949e]">{row.xp.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[#8b949e]">{row.mergedPrs}</td>
                  <td className="px-5 py-3 text-[#8b949e]">
                    {new Date(row.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(page > 0 || hasMore) && (
        <div className="mt-4 flex items-center justify-between text-[11px]">
          {page > 0 ? (
            <a
              href={`/maintainer/contributors?page=${page - 1}`}
              className="rounded border border-[#30363d] px-4 py-2 text-[#8b949e] transition-colors hover:text-white"
            >
              ← Previous
            </a>
          ) : (
            <div />
          )}
          <span className="text-[#8b949e]">Page {page + 1}</span>
          {hasMore ? (
            <a
              href={`/maintainer/contributors?page=${page + 1}`}
              className="rounded border border-[#30363d] px-4 py-2 text-[#8b949e] transition-colors hover:text-white"
            >
              Next →
            </a>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}
