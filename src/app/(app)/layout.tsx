import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * App shell layout for authenticated routes. Hard-redirects to / if not
 * signed in (middleware already handles this; layout is belt-and-suspenders
 * for the case where middleware ran with stale env).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = getServerSupabase();
  if (!sb) {
    // Service not configured — let the page render its own degraded state.
    return <>{children}</>;
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  return <>{children}</>;
}
