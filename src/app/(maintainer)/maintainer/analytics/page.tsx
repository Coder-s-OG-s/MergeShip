import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer, listMaintainerRepos } from '@/lib/maintainer/detect';
import { getMaintainerInstalls } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
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

  const service = getServiceSupabase();
  const installsRes = await getMaintainerInstalls();
  if (!isOk(installsRes) || installsRes.data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        No installations found.
      </div>
    );
  }

  const installs = installsRes.data;
  const installationId =
    searchParams.install && installs.find((i) => i.installationId === Number(searchParams.install))
      ? Number(searchParams.install)
      : installs[0]!.installationId;

  let totalXp = 0;
  let mergedThisMonth = 0;
  let activeContributors = 0;

  if (service) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const since = startOfMonth.toISOString();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const repos = await listMaintainerRepos(user.id, installationId);

    const [xpRes, mergedRes, activeRes] = await Promise.all([
      service.from('xp_events').select('amount').gte('created_at', since),
      repos.length > 0
        ? service
            .from('pull_requests')
            .select('id', { count: 'exact', head: true })
            .eq('state', 'merged')
            .gte('merged_at', since)
            .in('repo_full_name', repos)
        : Promise.resolve({ count: 0, data: [] }),
      repos.length > 0
        ? service
            .from('pull_requests')
            .select('author_user_id')
            .gte('github_created_at', thirtyDaysAgo)
            .in('repo_full_name', repos)
            .not('author_user_id', 'is', null)
        : Promise.resolve({ data: [] }),
    ]);

    totalXp = ((xpRes.data ?? []) as { amount: number }[]).reduce(
      (sum, r) => sum + (r.amount ?? 0),
      0,
    );
    mergedThisMonth = (mergedRes as { count: number | null }).count ?? 0;

    const uniqueActiveIds = new Set(
      ((activeRes.data ?? []) as { author_user_id: string | null }[])
        .map((r) => r.author_user_id)
        .filter(Boolean),
    );
    activeContributors = uniqueActiveIds.size;
  }

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">Coming Soon</p>
        </div>
      </div>

      {/* Placeholder stat cards with real data */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[#8b949e]">
            XP Distributed This Month
          </div>
          <div className="text-3xl font-bold text-[#00d26a]">{totalXp.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[#8b949e]">
            PRs Merged This Month
          </div>
          <div className="text-3xl font-bold text-[#58a6ff]">{mergedThisMonth}</div>
        </div>
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[#8b949e]">
            Active Contributors (30d)
          </div>
          <div className="text-3xl font-bold text-white">{activeContributors}</div>
        </div>
      </div>

      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <div className="mb-3 text-4xl font-bold text-[#00d26a]">Coming Soon</div>
        <p className="text-[13px] text-[#8b949e]">
          Full analytics dashboard — charts, trends, contributor growth, XP velocity — is in
          development.
        </p>
      </div>
    </div>
  );
}
