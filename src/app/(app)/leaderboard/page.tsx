import Link from 'next/link';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { scope?: string; id?: string };
}) {
  const scope = (searchParams.scope as 'global' | 'cohort' | 'language' | 'tag') ?? 'global';
  const scopeId = searchParams.id ?? null;
  const result = await getLeaderboard(scope, scopeId, 50);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 md:px-12 md:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Leaderboard</h1>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm md:mt-4">
          <Link
            href="/leaderboard?scope=global"
            className={`rounded-lg px-3 py-1 transition-colors ${scope === 'global' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Global
          </Link>
        </nav>

        <ul className="mt-6 divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {isOk(result) && result.data.length === 0 ? (
            <li className="p-4 text-center text-[11px] uppercase tracking-widest text-zinc-500 sm:p-6">
              BE THE FIRST ON THE BOARD — MERGE A PR TO EARN XP
            </li>
          ) : isOk(result) ? (
            result.data.map((entry) => (
              <li key={entry.userId} className="flex flex-wrap items-center gap-2 p-3 sm:gap-4 sm:p-4">
                <span className="w-8 text-zinc-500">#{entry.rank}</span>
                {entry.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                )}
                <Link
                  href={`/@${entry.githubHandle}`}
                  className="flex-1 min-w-fit hover:underline"
                >
                  <span className="font-medium">@{entry.githubHandle}</span>
                  {entry.displayName && (
                    <span className="ml-2 hidden text-sm text-zinc-500 sm:inline">
                      {entry.displayName}
                    </span>
                  )}
                </Link>
                <span className="order-5 w-full text-right text-sm text-zinc-500 sm:order-none sm:w-auto">
                  {entry.displayName}
                </span>
                <span className="order-3 text-sm tabular-nums sm:order-none">L{entry.level}</span>
                <span className="order-4 w-full text-right tabular-nums sm:order-none sm:w-20">
                  {entry.xp.toLocaleString()} XP
                </span>
              </li>
            ))
          ) : (
            <li className="p-4 text-rose-400 sm:p-6">Couldn&apos;t load: {result.error.message}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
