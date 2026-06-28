import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { isOk } from '@/lib/result';
import { LeaderboardContent } from './leaderboard-content';
import { tryGetDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  let scope = resolvedSearchParams.scope ?? 'global';
  let scopeId = resolvedSearchParams.id ?? null;

  const sb = await getServerSupabase();

  let user: User | null = null;
  let userHandle: string | null = null;
  let userXp = 0;
  let userLevel = 0;
  let userMerges = 0;
  let userStreak = 0;
  let avatarUrl: string | null = null;

  if (sb) {
    const { data } = await sb.auth.getUser();
    user = data.user;
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

  // Map organization requested scope to cohort scope
  if (scope === 'organization') {
    scope = 'cohort';
    if (!scopeId && user) {
      const db = tryGetDb();
      if (db) {
        const cohortRows = await db.execute<{ slug: string }>(sql`
          select c.slug
          from cohort_members cm
          join cohorts c on c.id = cm.cohort_id
          where cm.user_id = ${user.id}
          order by cm.joined_at desc
          limit 1
        `);
        const firstRow = Array.isArray(cohortRows)
          ? cohortRows[0]
          : (cohortRows as unknown as { rows: { slug: string }[] }).rows?.[0];
        if (firstRow?.slug) {
          scopeId = firstRow.slug;
        }
      }
    }
  }

  const finalScope = (
    ['global', 'cohort', 'language', 'tag', 'monthly', 'friends'].includes(scope) ? scope : 'global'
  ) as 'global' | 'cohort' | 'language' | 'tag' | 'monthly' | 'friends';

  // Supported Tab type for LeaderboardContent is: 'global' | 'monthly' | 'organization' | 'friends'
  let activeTab: 'global' | 'monthly' | 'organization' | 'friends' = 'global';
  const requestedScope = resolvedSearchParams.scope ?? 'global';
  if (
    requestedScope === 'monthly' ||
    requestedScope === 'organization' ||
    requestedScope === 'friends'
  ) {
    activeTab = requestedScope;
  } else if (requestedScope === 'cohort') {
    activeTab = 'organization';
  }

  const result = await getLeaderboard(finalScope, scopeId, 100);

  return (
    <LeaderboardContent
      activeTab={activeTab}
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
