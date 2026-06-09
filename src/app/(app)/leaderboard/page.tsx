import { getLeaderboard, type LeaderboardScope } from '@/app/actions/leaderboard';
import { isOk } from '@/lib/result';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { LeaderboardClient } from './leaderboard-client';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; id?: string }> | { scope?: string; id?: string };
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const scope = (resolvedParams.scope as LeaderboardScope) ?? 'global';
  const scopeId = resolvedParams.id ?? null;

  const sb = await getServerSupabase();
  if (!sb) {
    return <NotConfigured />;
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service) return <NotConfigured />;

  // Fetch the logged-in user's profile details
  const { data: profile } = await service
    .from('profiles')
    .select('github_handle, xp')
    .eq('id', user.id)
    .maybeSingle();

  const currentUser = profile
    ? {
        id: user.id,
        githubHandle: profile.github_handle,
        xp: profile.xp,
      }
    : null;

  const result = await getLeaderboard(scope, scopeId, 50);

  if (!isOk(result)) {
    return (
      <div className="min-h-screen bg-[#0D0E12] px-6 py-20 font-mono text-white">
        <div className="mx-auto max-w-xl rounded-sm border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="mb-4 font-serif text-3xl font-bold text-red-500">
            Error Loading Leaderboard
          </h1>
          <p className="text-zinc-400">{result.error?.message || 'Something went wrong.'}</p>
        </div>
      </div>
    );
  }

  const { entries, currentUserRank, rivalAbove, rivalBelow, totalContributors, totalXpShipped } =
    result.data;

  return (
    <LeaderboardClient
      entries={entries}
      currentUserRank={currentUserRank}
      rivalAbove={rivalAbove}
      rivalBelow={rivalBelow}
      totalContributors={totalContributors}
      totalXpShipped={totalXpShipped}
      currentScope={scope}
      currentUser={currentUser}
    />
  );
}

function NotConfigured() {
  return (
    <div className="min-h-screen bg-[#0D0E12] px-6 py-20 font-mono text-white">
      <div className="mx-auto max-w-xl rounded-sm border border-zinc-800 bg-zinc-950 p-8">
        <h1 className="mb-4 font-serif text-3xl font-bold">Leaderboard not configured</h1>
        <p className="text-zinc-500">Authentication system isn&apos;t fully loaded.</p>
      </div>
    </div>
  );
}
