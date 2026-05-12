import { createClient } from '@supabase/supabase-js';
import { readServiceEnv } from './env';

/**
 * Service-role Supabase client. Bypasses RLS. Server-only — never import
 * in client code. Returns null if env vars are missing.
 *
 * Used by webhook handlers, Inngest functions, seed scripts.
 */
export function getServiceSupabase() {
  const env = readServiceEnv();
  if (!env) return null;
  return createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
