import { getRecommendations } from '@/app/actions/recommendations';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { isErr, isOk } from '@/lib/result';
import RecCards from './rec-cards';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = getServerSupabase();
  if (!sb) {
    return <NotConfigured />;
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  // Service role for the profile read — same reasoning as middleware /install:
  // user-scoped client can miss the row during session cookie refresh.
  const service = getServiceSupabase();
  const { data: profile } = await (service ?? sb)
    .from('profiles')
    .select('github_handle, xp, level, audit_completed')
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const { needed, next } = xpToNextLevel(xp);

  const recsResult = await getRecommendations();

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-3xl font-bold">
              Welcome back, @{profile?.github_handle ?? 'contributor'}
            </h1>
            <div className="text-right">
              <div className="font-display text-sm uppercase tracking-wide text-zinc-500">
                Level
              </div>
              <div className="font-display text-3xl font-bold">L{level}</div>
            </div>
          </div>

          <div className="mt-4 text-sm text-zinc-400">
            {profile?.audit_completed ? null : (
              <span className="text-amber-400">
                Audit running in the background — your level will update shortly.
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{xp.toLocaleString()} XP</span>
              {next !== null && (
                <span>
                  {needed} XP to L{next}
                </span>
              )}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${levelProgressPct(xp, level)}%` }}
              />
            </div>
          </div>
        </header>

        <section>
          <h2 className="mb-4 font-display text-xl font-semibold">Today&apos;s recommendations</h2>

          {isErr(recsResult) ? (
            <p className="text-red-400">Couldn&apos;t load recs: {recsResult.error.message}</p>
          ) : isOk(recsResult) && recsResult.data.length === 0 ? (
            <EmptyRecs />
          ) : isOk(recsResult) ? (
            <RecCards recs={recsResult.data} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function levelProgressPct(xp: number, level: number): number {
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  if (ceiling <= floor) return 100;
  const pct = ((xp - floor) / (ceiling - floor)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function EmptyRecs() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
      <p className="text-zinc-300">No recommendations yet.</p>
      <p className="mt-2 text-sm text-zinc-500">
        The recommendation sweep runs every 30 minutes and seeds new picks based on your forks and
        your level. Check back shortly.
      </p>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="min-h-screen px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 font-display text-3xl font-bold">Dashboard not configured</h1>
        <p className="text-gray-400">Auth isn&apos;t wired on this deployment yet.</p>
      </div>
    </div>
  );
}
