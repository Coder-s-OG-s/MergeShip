import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { readSupabaseEnv } from './env';

/**
 * Server-side Supabase client tied to the current request's cookies.
 * Returns null if env vars are missing so callers can short-circuit
 * to a "service not configured" response instead of crashing.
 */
export function getServerSupabase() {
  const env = readSupabaseEnv();
  if (!env) return null;

  const cookieStore = cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll called from a server component — middleware handles refresh, ignore.
        }
      },
    },
  });
}
