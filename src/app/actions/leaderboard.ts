'use server';

import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import { getServerSupabase } from '@/lib/supabase/server';

export type LeaderboardScope = 'global' | 'cohort' | 'language' | 'tag';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  githubHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  githubTotalMerges: number;
  githubStreak: number;
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
  }>
> {
  const cacheKey = `leaderboard:${scope}:${scopeId ?? 'all'}:${limit}`;
  const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
  let entries: LeaderboardEntry[] = cached ?? [];

  const db = tryGetDb();
  if (!db) return err('not_configured', 'database not configured');

  let rows: {
    id: string;
    github_handle: string;
    display_name: string | null;
    avatar_url: string | null;
    xp: number;
    level: number;
    github_total_merges: number;
    github_streak: number;
  }[] = [];

  if (!cached) {
    if (scope === 'global') {
      rows = (await db.execute(sql`
      select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
      from profiles
      order by xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
    } else if (scope === 'cohort' && scopeId) {
      rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level, p.github_total_merges, p.github_streak
      from profiles p
      join cohort_members cm on cm.user_id = p.id
      join cohorts c on c.id = cm.cohort_id
      where c.slug = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
    } else if (scope === 'language' && scopeId) {
      rows = (await db.execute(sql`
      select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
      from profiles
      where primary_language = ${scopeId}
      order by xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
    } else if (scope === 'tag' && scopeId) {
      rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level, p.github_total_merges, p.github_streak
      from profiles p
      join profile_tags pt on pt.user_id = p.id
      where pt.tag = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
    } else {
      return err('invalid_scope', `scope ${scope} requires a scopeId`);
    }

    const list: typeof rows = Array.isArray(rows)
      ? rows
      : (rows as unknown as { rows: typeof rows }).rows;

    entries = list.map((r, i) => ({
      rank: i + 1,
      userId: r.id,
      githubHandle: r.github_handle,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      xp: r.xp,
      level: r.level,
      githubTotalMerges: r.github_total_merges,
      githubStreak: r.github_streak,
    }));

    await cacheSet(cacheKey, entries, TTL);
  }

  const sb = await getServerSupabase();

  let currentUserRank: LeaderboardEntry | null = null;

  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (user) {
      let rankQuery: ReturnType<typeof sql> | null;

      if (scope === 'global') {
        rankQuery = sql`
        select count(*) + 1 as rank
        from profiles
        where xp > (
          select xp from profiles where id = ${user.id}
        )
      `;
      } else if (scope === 'language' && scopeId) {
        rankQuery = sql`
        select count(*) + 1 as rank
        from profiles
        where primary_language = ${scopeId}
          and xp > (
            select xp
from profiles
where id = ${user.id}
  and primary_language = ${scopeId}
          )
      `;
      } else {
        rankQuery = null;
      }

      if (rankQuery) {
        const rankResult = (await db.execute(rankQuery)) as unknown as {
          rank: number;
        }[];

        let userQuery: ReturnType<typeof sql> | null;

        if (scope === 'global') {
          userQuery = sql`
    select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
    from profiles
    where id = ${user.id}
    limit 1
  `;
        } else if (scope === 'language' && scopeId) {
          userQuery = sql`
    select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
    from profiles
    where id = ${user.id}
      and primary_language = ${scopeId}
    limit 1
  `;
        } else {
          userQuery = null;
        }

        if (userQuery) {
          const userRows = (await db.execute(userQuery)) as unknown as {
            id: string;
            github_handle: string;
            display_name: string | null;
            avatar_url: string | null;
            xp: number;
            level: number;
            github_total_merges: number;
            github_streak: number;
          }[];

          const current = userRows[0];

          if (current && rankResult[0]) {
            currentUserRank = {
              rank: Number(rankResult[0].rank),
              userId: current.id,
              githubHandle: current.github_handle,
              displayName: current.display_name,
              avatarUrl: current.avatar_url,
              xp: current.xp,
              level: current.level,
              githubTotalMerges: current.github_total_merges,
              githubStreak: current.github_streak,
            };
          }
        }
      }
    }
  }

  return ok({
    entries,
    currentUserRank,
  });
}
