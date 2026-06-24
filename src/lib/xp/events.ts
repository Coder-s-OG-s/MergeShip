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
  dailyCapLimit?: {
    action: string;
    limit: number;
  };
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

  let inserted = false;

  if (event.dailyCapLimit) {
    const { action, limit } = event.dailyCapLimit;
    const todayDate = new Date().toISOString().slice(0, 10);

    try {
      inserted = await db.transaction(async (tx) => {
        // Increment the count in xp_daily_usage table atomically
        const res = await tx.execute<{ count: number }>(sql`
          insert into xp_daily_usage (user_id, date, action, count)
          values (${event.userId}, ${todayDate}::date, ${action}, 1)
          on conflict (user_id, date, action)
          do update set count = xp_daily_usage.count + 1
          returning count
        `);
        const list = Array.isArray(res) ? res : (res as any).rows;
        const count = list[0]?.count ?? 1;

        if (count > limit) {
          throw new Error('daily_review_cap_reached');
        }

        // Insert the event
        const result = await tx
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

        if (result.length === 0) {
          // Duplicate insertion, roll back the daily count increment!
          tx.rollback();
          return false;
        }

        return true;
      });
    } catch (err: any) {
      if (err.message === 'daily_review_cap_reached') {
        throw err;
      }
      inserted = false;
    }
  } else {
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

    inserted = result.length > 0;
  }
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
