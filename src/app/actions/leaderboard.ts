'use server';

import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import { getServerSupabase } from '@/lib/supabase/server';
import { computeCurrentStreak } from '@/lib/xp/streak';

export type LeaderboardScope =
  | 'global'
  | 'monthly'
  | 'organization'
  | 'friends'
  | 'cohort'
  | 'language'
  | 'tag';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  githubHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  mergedPRs: number;
  streak: number;
};

const TTL = 60 * 10;

export async function getLeaderboard(
  scope: LeaderboardScope,
  scopeId: string | null,
  limit = 50,
): Promise<
  Result<{
    entries: LeaderboardEntry[];
    currentUserRank: LeaderboardEntry | null;
    totalContributors: number;
    totalXpShipped: number;
    rivalAbove: LeaderboardEntry | null;
    rivalBelow: LeaderboardEntry | null;
  }>
> {
  const db = tryGetDb();
  if (!db) return err('not_configured', 'database not configured');

  const sb = await getServerSupabase();
  let currentUserId: string | null = null;
  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    currentUserId = user?.id ?? null;
  }

  const cacheKey = `leaderboard:${scope}:${scopeId ?? 'all'}:${currentUserId ?? 'guest'}:${limit}`;
  const cached = await cacheGet<any>(cacheKey);
  if (cached) {
    return ok(cached);
  }

  // Get total stats
  const statsRes = (await db.execute(sql`
    select count(*)::int as total_users, coalesce(sum(xp), 0)::int as total_xp from profiles
  `)) as unknown as { total_users: number; total_xp: number }[];
  const totalContributors = statsRes[0]?.total_users ?? 0;
  const totalXpShipped = statsRes[0]?.total_xp ?? 0;

  let rows: {
    id: string;
    github_handle: string;
    display_name: string | null;
    avatar_url: string | null;
    xp: number;
    level: number;
    merged_count: number;
  }[] = [];

  const todayYmd = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

  if (scope === 'global') {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
             (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
      from profiles p
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'monthly') {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.level,
             coalesce(sum(xe.xp_delta), 0)::int as xp,
             (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
      from profiles p
      left join xp_events xe on xe.user_id = p.id and xe.created_at >= now() - interval '30 days'
      group by p.id, p.github_handle, p.display_name, p.avatar_url, p.level
      order by xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'organization') {
    // If not logged in, fall back to global
    if (!currentUserId) {
      rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
               (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
        from profiles p
        order by p.xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
    } else {
      rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
               (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
        from profiles p
        where p.id in (
          select distinct user_id
          from github_installation_users
          where installation_id in (
            select installation_id
            from github_installation_users
            where user_id = ${currentUserId}
          )
        )
        order by p.xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
      // Fallback to global if empty
      if (rows.length === 0) {
        rows = (await db.execute(sql`
          select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
                 (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
          from profiles p
          order by p.xp desc
          limit ${limit}
        `)) as unknown as typeof rows;
      }
    }
  } else if (scope === 'friends') {
    // If not logged in, fall back to global
    if (!currentUserId) {
      rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
               (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
        from profiles p
        order by p.xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
    } else {
      rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
               (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
        from profiles p
        where p.id in (
          select distinct user_id
          from cohort_members
          where cohort_id in (
            select cohort_id
            from cohort_members
            where user_id = ${currentUserId}
          )
        )
        order by p.xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
      // Fallback to global if empty
      if (rows.length === 0) {
        rows = (await db.execute(sql`
          select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
                 (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
          from profiles p
          order by p.xp desc
          limit ${limit}
        `)) as unknown as typeof rows;
      }
    }
  } else if (scope === 'cohort' && scopeId) {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
             (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
      from profiles p
      join cohort_members cm on cm.user_id = p.id
      join cohorts c on c.id = cm.cohort_id
      where c.slug = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'language' && scopeId) {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
             (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
      from profiles p
      where p.primary_language = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'tag' && scopeId) {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
             (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
      from profiles p
      join profile_tags pt on pt.user_id = p.id
      where pt.tag = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else {
    return err('invalid_scope', `scope ${scope} requires a scopeId`);
  }

  const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: typeof rows }).rows;

  const userIds = list.map((r) => r.id);
  const events =
    userIds.length > 0
      ? ((await db.execute(sql`
          select user_id, created_at
          from xp_events
          where user_id in (${sql.raw(userIds.map((id) => `'${id}'`).join(','))})
            and created_at >= ${cutoff}
          order by created_at desc
        `)) as unknown as { user_id: string; created_at: string }[])
      : [];

  const userEvents: Record<string, { created_at: string }[]> = {};
  for (const e of events) {
    let uList = userEvents[e.user_id];
    if (!uList) {
      uList = [];
      userEvents[e.user_id] = uList;
    }
    uList.push({ created_at: e.created_at });
  }

  const entries: LeaderboardEntry[] = list.map((r, i) => {
    const uEvents = userEvents[r.id] ?? [];
    const streakVal = computeCurrentStreak(uEvents, todayYmd);
    return {
      rank: i + 1,
      userId: r.id,
      githubHandle: r.github_handle,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      xp: r.xp,
      level: r.level,
      mergedPRs: Number(r.merged_count ?? 0),
      streak: streakVal,
    };
  });

  // Calculate currentUserRank
  let currentUserRank: LeaderboardEntry | null = null;
  let rivalAbove: LeaderboardEntry | null = null;
  let rivalBelow: LeaderboardEntry | null = null;

  if (currentUserId) {
    let rankQuery: ReturnType<typeof sql> | null = null;

    if (scope === 'global' || scope === 'organization' || scope === 'friends') {
      rankQuery = sql`
        select count(*) + 1 as rank
        from profiles
        where xp > (
          select xp from profiles where id = ${currentUserId}
        )
      `;
    } else if (scope === 'monthly') {
      rankQuery = sql`
        select count(*) + 1 as rank
        from (
          select user_id, coalesce(sum(xp_delta), 0) as user_xp
          from xp_events
          where created_at >= now() - interval '30 days'
          group by user_id
        ) t
        where user_xp > coalesce((
          select sum(xp_delta)
          from xp_events
          where user_id = ${currentUserId}
            and created_at >= now() - interval '30 days'
        ), 0)
      `;
    } else if (scope === 'language' && scopeId) {
      rankQuery = sql`
        select count(*) + 1 as rank
        from profiles
        where primary_language = ${scopeId}
          and xp > (
            select xp
            from profiles
            where id = ${currentUserId}
              and primary_language = ${scopeId}
          )
      `;
    }

    if (rankQuery) {
      const rankResult = (await db.execute(rankQuery)) as unknown as {
        rank: number;
      }[];

      let userQuery = sql`
        select id, github_handle, display_name, avatar_url, xp, level
        from profiles
        where id = ${currentUserId}
        limit 1
      `;

      const userRows = (await db.execute(userQuery)) as unknown as {
        id: string;
        github_handle: string;
        display_name: string | null;
        avatar_url: string | null;
        xp: number;
        level: number;
      }[];

      const current = userRows[0];
      if (current && rankResult[0]) {
        const mergedCountRes = (await db.execute(sql`
          select count(*)::int as count from pull_requests where author_user_id = ${currentUserId} and state = 'merged'
        `)) as unknown as { count: number }[];
        const uEvents = (await db.execute(sql`
          select created_at from xp_events where user_id = ${currentUserId} and created_at >= ${cutoff} order by created_at desc
        `)) as unknown as { created_at: string }[];
        const streakVal = computeCurrentStreak(uEvents, todayYmd);

        currentUserRank = {
          rank: Number(rankResult[0].rank),
          userId: current.id,
          githubHandle: current.github_handle,
          displayName: current.display_name,
          avatarUrl: current.avatar_url,
          xp: current.xp,
          level: current.level,
          mergedPRs: Number(mergedCountRes[0]?.count ?? 0),
          streak: streakVal,
        };
      }
    }

    // Rivals Above and Below
    if (currentUserRank) {
      const rivalAboveRes = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
               (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
        from profiles p
        where p.xp > ${currentUserRank.xp}
        order by p.xp asc
        limit 1
      `)) as unknown as typeof rows;

      const rivalBelowRes = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level,
               (select count(*)::int from pull_requests pr where pr.author_user_id = p.id and pr.state = 'merged') as merged_count
        from profiles p
        where p.xp < ${currentUserRank.xp}
        order by p.xp desc
        limit 1
      `)) as unknown as typeof rows;

      if (rivalAboveRes[0]) {
        const uEvents = (await db.execute(sql`
          select created_at from xp_events where user_id = ${rivalAboveRes[0].id} and created_at >= ${cutoff} order by created_at desc
        `)) as unknown as { created_at: string }[];
        const streakVal = computeCurrentStreak(uEvents, todayYmd);
        rivalAbove = {
          rank: currentUserRank.rank - 1,
          userId: rivalAboveRes[0].id,
          githubHandle: rivalAboveRes[0].github_handle,
          displayName: rivalAboveRes[0].display_name,
          avatarUrl: rivalAboveRes[0].avatar_url,
          xp: rivalAboveRes[0].xp,
          level: rivalAboveRes[0].level,
          mergedPRs: Number(rivalAboveRes[0].merged_count ?? 0),
          streak: streakVal,
        };
      }

      if (rivalBelowRes[0]) {
        const uEvents = (await db.execute(sql`
          select created_at from xp_events where user_id = ${rivalBelowRes[0].id} and created_at >= ${cutoff} order by created_at desc
        `)) as unknown as { created_at: string }[];
        const streakVal = computeCurrentStreak(uEvents, todayYmd);
        rivalBelow = {
          rank: currentUserRank.rank + 1,
          userId: rivalBelowRes[0].id,
          githubHandle: rivalBelowRes[0].github_handle,
          displayName: rivalBelowRes[0].display_name,
          avatarUrl: rivalBelowRes[0].avatar_url,
          xp: rivalBelowRes[0].xp,
          level: rivalBelowRes[0].level,
          mergedPRs: Number(rivalBelowRes[0].merged_count ?? 0),
          streak: streakVal,
        };
      }
    }
  }

  const resultPayload = {
    entries,
    currentUserRank,
    totalContributors,
    totalXpShipped,
    rivalAbove,
    rivalBelow,
  };

  await cacheSet(cacheKey, resultPayload, TTL);
  return ok(resultPayload);
}
