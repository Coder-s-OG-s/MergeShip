'use server';

import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAppOctokit, getInstallOctokit } from '@/lib/github/app';
import { requireUser } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';

export type LeaderboardScope = 'global' | 'cohort' | 'language' | 'tag' | 'monthly' | 'friends';

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

async function getFollowedHandles(
  userId: string,
  userHandle: string | null,
  db: any,
): Promise<string[]> {
  const cacheKey = `user:following:${userId}`;
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  let followedHandles: string[] = [];
  let activeHandle = userHandle;
  if (!activeHandle) {
    const userProfileRows = await db.execute(sql`
      select github_handle from profiles where id = ${userId} limit 1
    `);
    const firstProfileRow = Array.isArray(userProfileRows)
      ? userProfileRows[0]
      : (userProfileRows as any).rows?.[0];
    activeHandle = firstProfileRow?.github_handle || null;
  }

  if (activeHandle) {
    try {
      const installRows = await db.execute(sql`
        select id from github_installations where user_id = ${userId} and uninstalled_at is null limit 1
      `);
      const firstInstallRow = Array.isArray(installRows)
        ? installRows[0]
        : (installRows as any).rows?.[0];
      const installId = firstInstallRow?.id;
      let octokit;
      if (installId) {
        octokit = await getInstallOctokit(Number(installId));
      } else {
        octokit = getAppOctokit();
      }
      const MAX_PAGES = 5;
      let page = 1;
      let collected: string[] = [];
      while (page <= MAX_PAGES) {
        const { data } = await octokit.request('GET /users/{username}/following', {
          username: activeHandle,
          per_page: 100,
          page,
        });
        collected = collected.concat(data.map((f: any) => f.login));
        if (data.length < 100) break;
        page++;
      }
      followedHandles = collected;
    } catch (err) {
      console.error('Failed to fetch github following list:', err);
    }
    followedHandles.push(activeHandle);
  }

  if (followedHandles.length > 0) {
    await cacheSet(cacheKey, followedHandles, 600); // 10 minutes cache
  }

  return followedHandles;
}

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
    const sb = await getServerSupabase();
    let userId: string | null = null;
    let userHandle: string | null = null;
    if (sb) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) {
        userId = user.id;
        const identity = user.identities?.find((i) => i.provider === 'github');
        userHandle = (identity?.identity_data?.['user_name'] as string) ?? null;
      }
    }

    // Determine cache key. Personal scopes (like friends) are cached per-user, public ones are shared.
    const isUserSpecific = scope === 'friends';
    const cacheKey = `leaderboard:${scope}:${scopeId ?? 'all'}:${isUserSpecific ? userId : 'public'}:${limit}`;
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
      // Rate-limit non-friends scopes to prevent database resource exhaustion.
      if (scope !== 'friends') {
        const rlRes = await requireUser({
          rateLimit: { namespace: 'leaderboard', ...RATE_LIMIT_TIERS.STANDARD },
          rateLimitMessage: 'too many leaderboard requests, slow down',
        });
        if (!rlRes.ok) return rlRes;
      }

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
      } else if (scope === 'monthly') {
        rows = (await db.execute(sql`
        select p.id, p.github_handle, p.display_name, p.avatar_url,
               coalesce(sum(xe.xp_delta), 0)::int as xp,
               p.level, p.github_total_merges, p.github_streak,
               dense_rank() over (order by coalesce(sum(xe.xp_delta), 0) desc) as rank
        from profiles p
        join xp_events xe on xe.user_id = p.id
        where xe.created_at >= now() - interval '30 days'
        group by p.id
        order by xp desc
        limit ${limit}
      `)) as unknown as typeof rows;
      } else if (scope === 'friends') {
        const rlRes = await requireUser({
          rateLimit: { namespace: 'leaderboard:friends', limit: 10, windowSec: 60 },
          rateLimitMessage: 'too many friends leaderboard requests, slow down',
        });
        if (!rlRes.ok) return rlRes;

        let followedHandles: string[] = [];
        if (userId) {
          followedHandles = await getFollowedHandles(userId, userHandle, db);
        }

        if (followedHandles.length > 0) {
          rows = (await db.execute(sql`
            select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak,
                   dense_rank() over (order by xp desc) as rank
            from profiles
            where github_handle = any(${followedHandles})
            order by xp desc
            limit ${limit}
          `)) as unknown as typeof rows;
        } else {
          rows = [];
        }
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

    let currentUserRank: LeaderboardEntry | null = null;

    if (userId) {
      // First check if the current user is already in the list
      const inList = entries.find((e) => e.userId === userId);
      if (inList) {
        currentUserRank = inList;
      } else {
        let rankQuery: ReturnType<typeof sql> | null = null;
        let userQuery: ReturnType<typeof sql> | null = null;

        if (scope === 'global') {
          rankQuery = sql`
            with ranked_profiles as (
              select id, dense_rank() over (order by xp desc) as rank
              from profiles
            )
            select rank from ranked_profiles where id = ${userId}
          `;
          userQuery = sql`
            select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
            from profiles
            where id = ${userId}
            limit 1
          `;
        } else if (scope === 'language' && scopeId) {
          rankQuery = sql`
            with ranked_profiles as (
              select id, dense_rank() over (order by xp desc) as rank
              from profiles
              where primary_language = ${scopeId}
            )
            select rank from ranked_profiles where id = ${userId}
          `;
          userQuery = sql`
            select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
            from profiles
            where id = ${userId} and primary_language = ${scopeId}
            limit 1
          `;
        } else if (scope === 'cohort' && scopeId) {
          rankQuery = sql`
            with ranked_profiles as (
              select p.id, dense_rank() over (order by p.xp desc) as rank
              from profiles p
              join cohort_members cm on cm.user_id = p.id
              join cohorts c on c.id = cm.cohort_id
              where c.slug = ${scopeId}
            )
            select rank from ranked_profiles where id = ${userId}
          `;
          userQuery = sql`
            select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level, p.github_total_merges, p.github_streak
            from profiles p
            join cohort_members cm on cm.user_id = p.id
            join cohorts c on c.id = cm.cohort_id
            where p.id = ${userId} and c.slug = ${scopeId}
            limit 1
          `;
        } else if (scope === 'tag' && scopeId) {
          rankQuery = sql`
            with ranked_profiles as (
              select p.id, dense_rank() over (order by p.xp desc) as rank
              from profiles p
              join profile_tags pt on pt.user_id = p.id
              where pt.tag = ${scopeId}
            )
            select rank from ranked_profiles where id = ${userId}
          `;
          userQuery = sql`
            select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level, p.github_total_merges, p.github_streak
            from profiles p
            join profile_tags pt on pt.user_id = p.id
            where p.id = ${userId} and pt.tag = ${scopeId}
            limit 1
          `;
        } else if (scope === 'monthly') {
          rankQuery = sql`
            with monthly_xp as (
              select user_id, sum(xp_delta) as mxp
              from xp_events
              where created_at >= now() - interval '30 days'
              group by user_id
            ),
            ranked_profiles as (
              select user_id, dense_rank() over (order by mxp desc) as rank
              from monthly_xp
            )
            select rank from ranked_profiles where user_id = ${userId}
          `;
          userQuery = sql`
            select p.id, p.github_handle, p.display_name, p.avatar_url,
                   coalesce(sum(xe.xp_delta), 0)::int as xp,
                   p.level, p.github_total_merges, p.github_streak
            from profiles p
            left join xp_events xe on xe.user_id = p.id and xe.created_at >= now() - interval '30 days'
            where p.id = ${userId}
            group by p.id
            limit 1
          `;
        } else if (scope === 'friends') {
          const followedHandles = await getFollowedHandles(userId, userHandle, db);

          if (followedHandles.length > 0) {
            rankQuery = sql`
              with ranked_profiles as (
                select id, dense_rank() over (order by xp desc) as rank
                from profiles
                where github_handle = any(${followedHandles})
              )
              select rank from ranked_profiles where id = ${userId}
            `;
            userQuery = sql`
              select id, github_handle, display_name, avatar_url, xp, level, github_total_merges, github_streak
              from profiles
              where id = ${userId}
              limit 1
            `;
          }
        }

        if (rankQuery && userQuery) {
          const rankResult = (await db.execute(rankQuery)) as unknown as {
            rank: string | number;
          }[];
          const rankList = Array.isArray(rankResult)
            ? rankResult
            : (rankResult as unknown as { rows: typeof rankResult }).rows;

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
          const userRowsList = Array.isArray(userRows)
            ? userRows
            : (userRows as unknown as { rows: typeof userRows }).rows;

          const current = userRowsList[0];

          if (current && rankList[0]) {
            currentUserRank = {
              rank: Number(rankList[0].rank),
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

    return ok({
      entries,
      currentUserRank,
    });
  } catch (e: any) {
    console.error('getLeaderboard failed:', e);
    return err('database_error', e.message || 'database query failed');
  }
}
