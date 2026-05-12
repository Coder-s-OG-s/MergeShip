'use client';

import { createBrowserClient } from '@supabase/ssr';
import { readSupabaseEnv } from './env';

/**
 * Browser-side Supabase client. Returns null if env vars are missing
 * so call sites can degrade gracefully (sign-in disabled, etc.)
 * instead of crashing the entire page.
 */
export function getBrowserSupabase() {
  const env = readSupabaseEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.anonKey);
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}
