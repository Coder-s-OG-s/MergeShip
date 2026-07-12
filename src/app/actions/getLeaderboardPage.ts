'use server';

import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { ok, err, type Result } from '@/lib/result';

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

type ProfileRow = {
  id: string;
  github_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  github_total_merges: number | null;
  github_streak: number | null;
};

type CountRow = {
  count: number | string;
};

/**
 * Server-side paginated global leaderboard ordered by XP descending.
 * Uses OFFSET/LIMIT (Drizzle equivalent of Prisma skip/take).
 * Global rank = (page - 1) * pageSize + index + 1.
 */
export async function getLeaderboardPage(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Result<LeaderboardPageResult>> {
  const db = tryGetDb();
  if (!db) return err('not_configured', 'database not configured');

  const safePageSize = Math.max(1, Math.min(100, Math.floor(pageSize) || DEFAULT_PAGE_SIZE));
  const safePage = Math.max(1, Math.floor(page) || 1);
  const offset = (safePage - 1) * safePageSize;

  try {
    const [countResult, rowsResult] = await Promise.all([
      db.execute(sql`
        select count(*)::int as count
        from profiles
      `),
      db.execute(sql`
        select id, github_handle, display_name, avatar_url, xp, level,
               github_total_merges, github_streak
        from profiles
        order by xp desc
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

    const entries: LeaderboardPageEntry[] = rows.map((row, index) => ({
      rank: offset + index + 1,
      userId: row.id,
      githubHandle: row.github_handle,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      xp: row.xp ?? 0,
      level: row.level ?? 0,
      githubTotalMerges: row.github_total_merges ?? 0,
      githubStreak: row.github_streak ?? 0,
    }));

    return ok({
      entries,
      totalCount,
      page: safePage,
      pageSize: safePageSize,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'database query failed';
    return err('database_error', message);
  }
}
