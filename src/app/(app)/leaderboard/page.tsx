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
    <LeaderboardContent
      entries={isOk(result) ? result.data.entries : []}
      currentUserRank={isOk(result) ? result.data.currentUserRank : null}
      userHandle={userHandle}
      userXp={userXp}
      userLevel={userLevel}
      userMerges={userMerges}
      userStreak={userStreak}
      avatarUrl={avatarUrl}
    />
  );
}
