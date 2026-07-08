import { sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';

export type DomainEvent = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type StoredEvent = DomainEvent & {
  id: string;
  version: number;
  occurredAt: Date;
  processedAt: Date | null;
};

export async function appendEvent(event: DomainEvent): Promise<StoredEvent> {
  const db = getDb();

  const version = await nextVersion(event.aggregateType, event.aggregateId);

  const rows = await db
    .insert(schema.events)
    .values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      version,
      payload: event.payload as never,
      metadata: (event.metadata ?? {}) as never,
      idempotencyKey: event.idempotencyKey ?? null,
    })
    .returning();

  const row = rows[0]!;
  return {
    id: row.id,
    aggregateType: row.aggregateType!,
    aggregateId: row.aggregateId!,
    eventType: row.eventType!,
    version: row.version!,
    payload: row.payload as unknown as Record<string, unknown>,
    metadata: row.metadata as unknown as Record<string, unknown> | undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
    occurredAt: row.occurredAt!,
    processedAt: row.processedAt,
  };
}

export async function markProcessed(eventId: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.events)
    .set({ processedAt: new Date() })
    .where(sql`id = ${eventId}`);
}

export async function getEvents(
  aggregateType: string,
  aggregateId: string,
): Promise<StoredEvent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.events)
    .where(
      sql`${schema.events.aggregateType} = ${aggregateType}
        and ${schema.events.aggregateId} = ${aggregateId}`,
    )
    .orderBy(sql`version asc`);

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    aggregateType: r.aggregateType!,
    aggregateId: r.aggregateId!,
    eventType: r.eventType!,
    version: r.version!,
    payload: r.payload as unknown as Record<string, unknown>,
    metadata: r.metadata as unknown as Record<string, unknown> | undefined,
    idempotencyKey: r.idempotencyKey ?? undefined,
    occurredAt: r.occurredAt!,
    processedAt: r.processedAt,
  }));
}

async function nextVersion(aggregateType: string, aggregateId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ max: number | null }>(
    sql`select coalesce(max(version), 0) + 1 as max
        from events
        where aggregate_type = ${aggregateType}
          and aggregate_id = ${aggregateId}`,
  );
  const list = Array.isArray(rows) ? rows : (rows as { max: number | null }[]);
  return list[0]?.max ?? 1;
}
