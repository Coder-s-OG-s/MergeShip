'use server';

import { tryGetDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { getServerSupabase } from '@/lib/supabase/server';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_TTL = 60 * 5; // 5 minutes
const NULL_CACHE_TTL = 60; // 1 minute

type CohortEndDateResponse = {
  endsAt: string | null;
};

async function getUserCohortEndDate(userId: string): Promise<string | null> {
  const db = tryGetDb();
  if (!db) return null;

  const rows = await db.execute<{ ends_at: string | null }>(sql`
        select c.ends_at
        from cohort_members cm
        join cohorts c on c.id = cm.cohort_id
        where cm.user_id = ${userId}
        order by cm.joined_at desc
        limit 1
    `);

  const firstRow = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0];
  return firstRow?.ends_at || null;
}

export async function GET() {
  const sb = await getServerSupabase();
  let userId: string | null = null;

  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  if (!userId) {
    return Response.json({
      endsAt: null,
    });
  }

  const cacheKey = `cohort_end_date:${userId}`;
  const cached = await cacheGet<CohortEndDateResponse>(cacheKey);

  if (cached !== null) {
    return Response.json(cached);
  }

  const endsAt = await getUserCohortEndDate(userId);

  const result = {
    endsAt,
  };

  await cacheSet(cacheKey, result, endsAt ? CACHE_TTL : NULL_CACHE_TTL);

  return Response.json(result);
}
