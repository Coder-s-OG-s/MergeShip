'use server';

import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';
import { requireUser } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';

export type LeaderboardPageEntry = {
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

export type LeaderboardPageResult = {
  entries: LeaderboardPageEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
/** Same TTL as getLeaderboard (10 minutes). */
const TTL = 60 * 10;

type ProfileRow = {
  id: string;
  github_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  github_total_merges: number | null;
  github_streak: number | null;
  rank: number | string;
};

type CountRow = {
  count: number | string;
};

/**
 * Server-side paginated global leaderboard ordered by XP descending.
 * Uses OFFSET/LIMIT with a stable id tiebreaker.
 * Rank uses DENSE_RANK() so tied XP shares the same rank (matches getLeaderboard).
 */
export async function getLeaderboardPage(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Result<LeaderboardPageResult>> {
  const safePageSize = Math.max(1, Math.min(100, Math.floor(pageSize) || DEFAULT_PAGE_SIZE));
  const safePage = Math.max(1, Math.floor(page) || 1);
  const offset = (safePage - 1) * safePageSize;

  // Same key format as getLeaderboard: leaderboard:{scope}:{scopeId}:{public|userId}:{limit}
  // Page is included so each page is cached independently.
  const cacheKey = `leaderboard:global:all:public:${safePageSize}:${safePage}`;
  const cached = await cacheGet<LeaderboardPageResult>(cacheKey);
  if (cached) {
    return ok(cached);
  }

  // Rate-limit cache misses (issue #688 pattern — same namespace/tier as non-friends scopes).
  const rlRes = await requireUser({
    rateLimit: { namespace: 'leaderboard', ...RATE_LIMIT_TIERS.STANDARD },
    rateLimitMessage: 'too many leaderboard requests, slow down',
  });
  if (!rlRes.ok) return rlRes;

  const db = tryGetDb();
  if (!db) return err('not_configured', 'database not configured');

  try {
    const [countResult, rowsResult] = await Promise.all([
      db.execute(sql`
        select count(*)::int as count
        from profiles
      `),
      db.execute(sql`
        select id, github_handle, display_name, avatar_url, xp, level,
               github_total_merges, github_streak,
               dense_rank() over (order by xp desc) as rank
        from profiles
        order by xp desc, id asc
        limit ${safePageSize}
        offset ${offset}
      `),
    ]);

    const countList = (Array.isArray(countResult)
      ? countResult
      : ((countResult as unknown as { rows: CountRow[] }).rows ?? [])) as unknown as CountRow[];
    const totalCount = Number(countList[0]?.count ?? 0);

    const rows = (Array.isArray(rowsResult)
      ? rowsResult
      : ((rowsResult as unknown as { rows: ProfileRow[] }).rows ?? [])) as unknown as ProfileRow[];

    const entries: LeaderboardPageEntry[] = rows.map((row) => ({
      rank: Number(row.rank),
      userId: row.id,
      githubHandle: row.github_handle,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      xp: row.xp ?? 0,
      level: row.level ?? 0,
      githubTotalMerges: row.github_total_merges ?? 0,
      githubStreak: row.github_streak ?? 0,
    }));

    const result: LeaderboardPageResult = {
      entries,
      totalCount,
      page: safePage,
      pageSize: safePageSize,
    };

    await cacheSet(cacheKey, result, TTL);
    return ok(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'database query failed';
    return err('database_error', message);
  }
}
