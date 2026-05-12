'use server';

import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';

export type LeaderboardScope = 'global' | 'cohort' | 'language' | 'tag';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  githubHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
};

const TTL = 60 * 10;

export async function getLeaderboard(
  scope: LeaderboardScope,
  scopeId: string | null,
  limit = 50,
): Promise<Result<LeaderboardEntry[]>> {
  const cacheKey = `leaderboard:${scope}:${scopeId ?? 'all'}:${limit}`;
  const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
  if (cached) return ok(cached);

  const db = tryGetDb();
  if (!db) return err('not_configured', 'database not configured');

  let rows: {
    id: string;
    github_handle: string;
    display_name: string | null;
    avatar_url: string | null;
    xp: number;
    level: number;
  }[] = [];

  if (scope === 'global') {
    rows = (await db.execute(sql`
      select id, github_handle, display_name, avatar_url, xp, level
      from profiles
      order by xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'cohort' && scopeId) {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level
      from profiles p
      join cohort_members cm on cm.user_id = p.id
      join cohorts c on c.id = cm.cohort_id
      where c.slug = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'language' && scopeId) {
    rows = (await db.execute(sql`
      select id, github_handle, display_name, avatar_url, xp, level
      from profiles
      where primary_language = ${scopeId}
      order by xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else if (scope === 'tag' && scopeId) {
    rows = (await db.execute(sql`
      select p.id, p.github_handle, p.display_name, p.avatar_url, p.xp, p.level
      from profiles p
      join profile_tags pt on pt.user_id = p.id
      where pt.tag = ${scopeId}
      order by p.xp desc
      limit ${limit}
    `)) as unknown as typeof rows;
  } else {
    return err('invalid_scope', `scope ${scope} requires a scopeId`);
  }

  // drizzle execute returns { rows: [...] } in some versions; normalize
  const list: typeof rows = Array.isArray(rows)
    ? rows
    : (rows as unknown as { rows: typeof rows }).rows;

  const entries: LeaderboardEntry[] = list.map((r, i) => ({
    rank: i + 1,
    userId: r.id,
    githubHandle: r.github_handle,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    xp: r.xp,
    level: r.level,
  }));

  await cacheSet(cacheKey, entries, TTL);
  return ok(entries);
}
