import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getLeaderboard, type LeaderboardEntry } from '@/app/actions/leaderboard';
import { getLeaderboardPage } from '@/app/actions/getLeaderboardPage';
import { isOk } from '@/lib/result';
import { LeaderboardContent } from './leaderboard-content';
import { tryGetDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; id?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  let scope = resolvedSearchParams.scope ?? 'global';
  let scopeId = resolvedSearchParams.id ?? null;
  const page = Math.max(1, parseInt(resolvedSearchParams.page ?? '1', 10) || 1);

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

  let entries: LeaderboardEntry[] = [];
  let currentUserRank: LeaderboardEntry | null = null;
  let totalCount = 0;
  let pageSize = PAGE_SIZE;
  let currentPage = page;
  const useServerPagination = finalScope === 'global';

  if (useServerPagination) {
    const pageResult = await getLeaderboardPage(page, PAGE_SIZE);
    if (isOk(pageResult)) {
      entries = pageResult.data.entries;
      totalCount = pageResult.data.totalCount;
      pageSize = pageResult.data.pageSize;
      currentPage = pageResult.data.page;
    }

    if (user) {
      const onPage = entries.find((e) => e.userId === user.id) ?? null;
      if (onPage) {
        currentUserRank = onPage;
      } else {
        const db = tryGetDb();
        if (db) {
          const rankRows = await db.execute<{ rank: number | string }>(sql`
            with ranked_profiles as (
              select id, dense_rank() over (order by xp desc) as rank
              from profiles
            )
            select rank from ranked_profiles where id = ${user.id}
          `);
          const rankList = Array.isArray(rankRows)
            ? rankRows
            : ((rankRows as unknown as { rows: { rank: number | string }[] }).rows ?? []);
          const rank = rankList[0]?.rank;
          if (rank !== undefined) {
            currentUserRank = {
              rank: Number(rank),
              userId: user.id,
              githubHandle: userHandle ?? '',
              displayName: null,
              avatarUrl,
              xp: userXp,
              level: userLevel,
              githubTotalMerges: userMerges,
              githubStreak: userStreak,
            };
          }
        }
      }
    }
  } else {
    const result = await getLeaderboard(finalScope, scopeId, 100);
    if (isOk(result)) {
      entries = result.data.entries;
      currentUserRank = result.data.currentUserRank;
      totalCount = result.data.entries.length;
      pageSize = result.data.entries.length || PAGE_SIZE;
      currentPage = 1;
    }
  }

  return (
    <LeaderboardContent
      activeTab={activeTab}
      entries={entries}
      currentUserRank={currentUserRank}
      currentUserId={user?.id ?? null}
      userHandle={userHandle}
      userXp={userXp}
      userLevel={userLevel}
      userMerges={userMerges}
      userStreak={userStreak}
      avatarUrl={avatarUrl}
      totalCount={totalCount}
      page={currentPage}
      pageSize={pageSize}
      paginationEnabled={useServerPagination}
    />
  );
}
