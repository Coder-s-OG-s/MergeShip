import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';

/**
 * App shell layout for authenticated routes. Hard-redirects to / if not
 * signed in (middleware already handles this; layout is belt-and-suspenders
 * for the case where middleware ran with stale env).
 *
 * Renders a minimal top nav so testers can move between dashboard,
 * leaderboard, and help-inbox without poking URLs by hand.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = getServerSupabase();
  if (!sb) {
    return <>{children}</>;
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  let handle: string | null = null;
  let level = 0;
  const service = getServiceSupabase();
  if (service) {
    const { data: profile } = await service
      .from('profiles')
      .select('github_handle, level')
      .eq('id', user.id)
      .maybeSingle();
    handle = profile?.github_handle ?? null;
    level = profile?.level ?? 0;
  }

  return (
    <>
      <nav className="border-b border-zinc-900 bg-zinc-950 px-6 py-3 text-sm text-zinc-400">
        <div className="mx-auto flex max-w-5xl items-center gap-5">
          <Link href="/dashboard" className="font-display font-semibold text-white">
            MergeShip
          </Link>
          <Link href="/dashboard" className="hover:text-white">
            Dashboard
          </Link>
          <Link href="/leaderboard" className="hover:text-white">
            Leaderboard
          </Link>
          {level >= 2 && (
            <Link href="/help-inbox" className="hover:text-white">
              Help inbox
            </Link>
          )}
          {handle && (
            <Link
              href={`/@${handle}`}
              className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
            >
              @{handle}
            </Link>
          )}
        </div>
      </nav>
      {children}
    </>
  );
}
