import { sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';

export type IdempotencyResponse = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export async function checkIdempotency(key: string): Promise<IdempotencyResponse | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.idempotencyKeys.key,
      response: schema.idempotencyKeys.response,
    })
    .from(schema.idempotencyKeys)
    .where(sql`${schema.idempotencyKeys.key} = ${key}`)
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  return row.response as unknown as IdempotencyResponse;
}

export async function storeIdempotency(key: string, response: IdempotencyResponse): Promise<void> {
  const db = getDb();

  await db
    .insert(schema.idempotencyKeys)
    .values({
      key,
      response: response as never,
    })
    .onConflictDoNothing({ target: schema.idempotencyKeys.key });
}
