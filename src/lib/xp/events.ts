import { sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';

/**
 * Insert an XP event. Idempotent via UNIQUE(user_id, source, ref_id) on the table.
 * Duplicate inserts silently no-op (returns false). Trigger handles xp + level recompute.
 *
 * Returns true if the row was actually inserted, false if it was a duplicate.
 */

export type XpEventInsert = {
  userId: string;
  source: string;
  refType?: string;
  refId: string;
  repo?: string;
  difficulty?: 'E' | 'M' | 'H';
  xpDelta: number;
  metadata?: Record<string, unknown>;
};

export async function insertXpEvent(event: XpEventInsert): Promise<boolean> {
  const db = getDb();
  const result = await db
    .insert(schema.xpEvents)
    .values({
      userId: event.userId,
      source: event.source,
      refType: event.refType,
      refId: event.refId,
      repo: event.repo,
      difficulty: event.difficulty,
      xpDelta: event.xpDelta,
      metadata: event.metadata as never,
    })
    .onConflictDoNothing({
      target: [schema.xpEvents.userId, schema.xpEvents.source, schema.xpEvents.refId],
    })
    .returning({ id: schema.xpEvents.id });

  return result.length > 0;
}

/**
 * Sum xp_events for a given user. Used by reconcile job and audit verification.
 */
export async function sumXp(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ sum: number | null }>(
    sql`select coalesce(sum(xp_delta), 0)::int as sum from xp_events where user_id = ${userId}`,
  );
  // postgres-js returns rows directly, drizzle wraps; handle either
  const first = Array.isArray(rows) ? rows[0] : (rows as { sum: number | null }[])[0];
  return first?.sum ?? 0;
}
