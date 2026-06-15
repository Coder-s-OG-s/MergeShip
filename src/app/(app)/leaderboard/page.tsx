import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { isOk } from '@/lib/result';
import { LeaderboardContent } from './leaderboard-content';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const sb = await getServerSupabase();

  let userHandle: string | null = null;
  let userXp = 0;
  let userLevel = 0;
  let userMerges = 0;
  let userStreak = 0;
  let avatarUrl: string | null = null;

  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      const identity = user.identities?.find((i) => i.provider === 'github');
      avatarUrl = (identity?.identity_data?.['avatar_url'] as string) ?? null;

      const service = getServiceSupabase();
      if (service) {
        const { data: profile } = await service
          .from('profiles')
          .select('github_handle, xp, level, github_total_merges, github_streak')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          userHandle = profile.github_handle;
          userXp = profile.xp;
          userLevel = profile.level;
          userMerges = profile.github_total_merges;
          userStreak = profile.github_streak;
        }
      }
    }
  }

  const result = await getLeaderboard('global', null, 100);

  return (
    <div className="app-page">
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
