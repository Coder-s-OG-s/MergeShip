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
  try {
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
      rank: string | number;
    }[] = [];

    if (!cached) {
      if (scope === 'global') {
        rows = (await db.execute(sql`
        select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak,
               dense_rank() over (order by xp desc) as rank
        from profiles
        order by xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
      } else if (scope === 'cohort' && scopeId) {
        rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level, p.github_total_merges, p.github_streak,
               dense_rank() over (order by p.xp desc) as rank
        from profiles p
        join cohort_members cm on cm.user_id = p.id
        join cohorts c on c.id = cm.cohort_id
        where c.slug = ${scopeId}
        order by p.xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
      } else if (scope === 'language' && scopeId) {
        rows = (await db.execute(sql`
        select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak,
               dense_rank() over (order by xp desc) as rank
        from profiles
        where primary_language = ${scopeId}
        order by xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
      } else if (scope === 'tag' && scopeId) {
        rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level, p.github_total_merges, p.github_streak,
               dense_rank() over (order by p.xp desc) as rank
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

      entries = list.map((r) => ({
        rank: Number(r.rank),
        userId: r.id,
        githubHandle: r.github_handle,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        xp: r.xp ?? 0,
        level: r.level ?? 0,
        githubTotalMerges: r.github_total_merges ?? 0,
        githubStreak: r.github_streak ?? 0,
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
          with ranked_profiles as (
            select id, dense_rank() over (order by xp desc) as rank
            from profiles
          )
          select rank from ranked_profiles where id = ${user.id}
        `;
        } else if (scope === 'language' && scopeId) {
          rankQuery = sql`
          with ranked_profiles as (
            select id, dense_rank() over (order by xp desc) as rank
            from profiles
            where primary_language = ${scopeId}
          )
          select rank from ranked_profiles where id = ${user.id}
        `;
        } else {
          rankQuery = null;
        }

        if (rankQuery) {
          const rankResult = (await db.execute(rankQuery)) as unknown as {
            rank: string | number;
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
                xp: current.xp ?? 0,
                level: current.level ?? 0,
                githubTotalMerges: current.github_total_merges ?? 0,
                githubStreak: current.github_streak ?? 0,
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
  } catch (e: any) {
    console.error('getLeaderboard failed:', e);
    return err('database_error', e.message || 'database query failed');
  }
}
