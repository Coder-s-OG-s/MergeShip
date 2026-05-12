import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Drizzle DB client. Used for typed queries from server actions / Inngest.
 * Connection-pooled via postgres-js.
 *
 * For Supabase, use DATABASE_URL pointing at the pooler (port 6543) in prod,
 * direct port 5432 locally via `supabase start`.
 */

const databaseUrl = process.env.DATABASE_URL;

let _db: ReturnType<typeof makeDb> | null = null;

function makeDb(url: string) {
  const sql = postgres(url, { prepare: false });
  return drizzle(sql, { schema });
}

/**
 * Returns the Drizzle client, or null if DATABASE_URL is missing.
 * Call sites must handle null — pages should show "not configured", server
 * actions should return err('not_configured', ...).
 */
export function tryGetDb() {
  if (!databaseUrl) return null;
  if (!_db) _db = makeDb(databaseUrl);
  return _db;
}

/**
 * Hard variant — throws if DATABASE_URL missing. Use only in code paths that
 * cannot meaningfully degrade (Inngest functions, server-only writes).
 */
export function getDb() {
  if (!databaseUrl) throw new Error('DATABASE_URL not configured');
  if (!_db) _db = makeDb(databaseUrl);
  return _db;
}

export function isDbConfigured(): boolean {
  return Boolean(databaseUrl);
}

export { schema };
