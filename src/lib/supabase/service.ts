import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS. Server-only — never import in client code.
 * Used by webhook handlers, Inngest functions, seed scripts.
 */
export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE service role config missing');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
