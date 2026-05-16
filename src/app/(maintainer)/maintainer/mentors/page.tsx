import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getMaintainerMentors,
  type MentorRow,
} from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

function levelBadge(level: number): string {
  if (level === 2) return 'bg-cyan-900/40 text-cyan-300';
  return 'bg-purple-900/40 text-purple-300';
}

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: { install?: string };
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

  const mentorsRes = await getMaintainerMentors(installationId);
  const rows: MentorRow[] = isOk(mentorsRes) ? mentorsRes.data : [];

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mentors</h1>
        <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
          Level 2+ Contributors
        </p>
      </div>

      <div className="rounded-lg border border-[#30363d] bg-[#161b22]">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-zinc-500">
            No mentors found (level 2+ contributors).
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#30363d] text-[10px] uppercase tracking-widest text-[#8b949e]">
                <th className="px-5 py-3 text-left font-medium">Mentor</th>
                <th className="px-5 py-3 text-left font-medium">Level</th>
                <th className="px-5 py-3 text-left font-medium">XP</th>
                <th className="px-5 py-3 text-left font-medium">Help Resolved</th>
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
                  <td className="px-5 py-3">
                    {row.helpResolved > 0 ? (
                      <span className="text-[#00d26a]">{row.helpResolved}</span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
