import Link from 'next/link';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope =
    (resolvedSearchParams.scope as 'global' | 'cohort' | 'language' | 'tag') ?? 'global';
  const scopeId = resolvedSearchParams.id ?? null;
  const result = await getLeaderboard(scope, scopeId, 50);

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href="/leaderboard?scope=global"
            className={`rounded-lg px-3 py-1 ${scope === 'global' ? 'bg-zinc-800' : 'text-zinc-400 hover:text-white'}`}
          >
            Global
          </Link>
        </nav>

        <ul className="mt-6 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
          {isOk(result) && result.data.entries.length === 0 ? (
            <li className="p-6 text-zinc-400">No entries yet.</li>
          ) : isOk(result) ? (
            <>
              {(() => {
                // Current logged-in user handle from visible list
                const currentGithubHandle = result.data.entries.find(
                  (e: any) => e.rank,
                )?.githubHandle;

                const isUserVisible = result.data.entries.some(
                  (entry: any) => entry.githubHandle === currentGithubHandle,
                );

                return (
                  <>
                    {result.data.entries.map((entry: any) => {
                      const isMe = entry.githubHandle === currentGithubHandle;

                      return (
                        <li
                          key={entry.userId}
                          className={`flex items-center gap-4 p-4 ${
                            isMe ? 'bg-purple-950/30 text-purple-300' : ''
                          }`}
                        >
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

                          <Link href={`/@${entry.githubHandle}`} className="flex-1 hover:underline">
                            <span className="font-medium">@{entry.githubHandle}</span>

                            {entry.displayName && (
                              <span className="ml-2 text-sm text-zinc-500">
                                {entry.displayName}
                              </span>
                            )}

                            {isMe && <span className="ml-2 text-xs text-purple-400">(YOU)</span>}
                          </Link>

                          <span className="text-sm tabular-nums">L{entry.level}</span>

                          <span className="w-20 text-right tabular-nums">
                            {entry.xp.toLocaleString()} XP
                          </span>
                        </li>
                      );
                    })}

                    {!isUserVisible && (
                      <>
                        <li className="border-t border-zinc-700 px-4 pb-2 pt-4">
                          <span className="text-xs font-semibold tracking-wide text-zinc-500">
                            YOUR RANK
                          </span>
                        </li>

                        <li className="flex items-center gap-4 bg-purple-950/20 p-4 text-purple-300">
                          <span className="text-sm">Your rank is outside visible leaderboard.</span>
                        </li>
                      </>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <li className="p-6 text-rose-400">Couldn&apos;t load: {result.error.message}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
