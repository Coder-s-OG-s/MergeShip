import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { isOk } from '@/lib/result';
import { LeaderboardContent } from './leaderboard-content';

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
          userXp = profile.xp ?? 0;
          userLevel = profile.level ?? 0;
          userMerges = profile.github_total_merges ?? 0;
          userStreak = profile.github_streak ?? 0;
        }
      }
    }
  }

  const result = await getLeaderboard(scope, scopeId, 100);

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
