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
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
        <nav className="mt-4 flex gap-3 text-sm">
          <Link
            href="/leaderboard?scope=global"
            className={`rounded-lg px-3 py-1 ${scope === 'global' ? 'bg-zinc-800' : 'text-zinc-400 hover:text-white'}`}
          >
            Global
          </Link>
          <Link
            href="/leaderboard?scope=cohort&id=gssoc-26"
            className={`rounded-lg px-3 py-1 ${scope === 'cohort' ? 'bg-zinc-800' : 'text-zinc-400 hover:text-white'}`}
          >
            GSSoC &apos;26
          </Link>
          <Link
            href="/leaderboard?scope=language&id=TypeScript"
            className={`rounded-lg px-3 py-1 ${scope === 'language' ? 'bg-zinc-800' : 'text-zinc-400 hover:text-white'}`}
          >
            TypeScript
          </Link>
        </nav>

        <ul className="mt-6 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
          {isOk(result) && result.data.length === 0 ? (
            <li className="p-6 text-zinc-400">No entries yet.</li>
          ) : isOk(result) ? (
            result.data.map((entry) => (
              <li key={entry.userId} className="flex items-center gap-4 p-4">
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
                    <span className="ml-2 text-sm text-zinc-500">{entry.displayName}</span>
                  )}
                </Link>
                <span className="text-sm tabular-nums">L{entry.level}</span>
                <span className="w-20 text-right tabular-nums">{entry.xp.toLocaleString()} XP</span>
              </li>
            ))
          ) : (
            <li className="p-6 text-rose-400">Couldn&apos;t load: {result.error.message}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
