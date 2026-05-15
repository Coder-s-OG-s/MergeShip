import { sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { shouldFireTripwire, TRIPWIRE_THRESHOLD } from './tripwire';

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

  // Snapshot today's prior total so the tripwire check sees the value
  // BEFORE this event lands. Done as a separate query because the trigger
  // recompute happens atomically on insert — we can't observe it client-side.
  let priorTodayTotal = 0;
  try {
    priorTodayTotal = await sumXpToday(event.userId);
  } catch {
    // Tripwire is best-effort. Never block the XP insert.
  }

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

  const inserted = result.length > 0;
  if (inserted && shouldFireTripwire(priorTodayTotal, event.xpDelta)) {
    try {
      await db.execute(sql`
        insert into activity_log (user_id, kind, detail)
        values (
          ${event.userId},
          'xp_tripwire',
          ${JSON.stringify({
            threshold: TRIPWIRE_THRESHOLD,
            priorTodayTotal,
            triggeringDelta: event.xpDelta,
            source: event.source,
            refId: event.refId,
          })}::jsonb
        )
      `);
    } catch {
      // Logging-only, never throw out of the insert path.
    }
  }

  return inserted;
}

async function sumXpToday(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ sum: number | null }>(
    sql`select coalesce(sum(xp_delta), 0)::int as sum
        from xp_events
        where user_id = ${userId}
          and created_at >= date_trunc('day', now() at time zone 'UTC')`,
  );
  const first = Array.isArray(rows) ? rows[0] : (rows as { sum: number | null }[])[0];
  return first?.sum ?? 0;
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
