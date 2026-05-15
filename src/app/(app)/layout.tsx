import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { NavItems } from './nav-items';
import { LogoutButton } from './logout-button';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  icons: {
    icon: '/favicon.svg',
  },
};

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

  let isMaintainer = false;
  try {
    isMaintainer = await isUserMaintainer(user.id);
  } catch {
    // never break the layout
  }

  return (
    <>
      <nav className="border-b border-zinc-900 bg-zinc-950 px-6 py-3 text-sm text-zinc-400">
        <div className="mx-auto flex max-w-5xl items-center gap-5">
          <Link href="/" className="font-display font-semibold text-white">
            MergeShip
          </Link>
          <Link href="/dashboard" className="hover:text-white">
            Dashboard
          </Link>
          <Link href="/leaderboard" className="hover:text-white">
            Leaderboard
          </Link>
          {isMaintainer && (
            <Link href="/maintainer" className="hover:text-white">
              Maintainer
            </Link>
          )}
          {level >= 2 && (
            <Link href="/help-inbox" className="hover:text-white">
              Help inbox
            </Link>
          )}
          {handle && (
    <div className="flex h-screen overflow-hidden bg-[#111318] font-mono text-white">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-[#2d333b] bg-[#111318]">
        <div>
          <div className="p-8 pb-12">
            <Link
              href="/dashboard"
              className="font-serif text-2xl font-bold tracking-wider text-white"
            >
              MERGESHIP
            </Link>
          </div>

          <nav className="flex flex-col gap-1 px-4">
            <NavItems profileHref={`/@${handle}`} level={level} isMaintainer={isMaintainer} />
          </nav>
        </div>

        <div className="border-t border-[#2d333b] p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-zinc-800">
              <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-xs">
                {handle?.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="truncate text-[13px] font-bold uppercase">
                {handle || 'CONTRIBUTOR'}
              </div>
              <div className="truncate text-[11px] tracking-wider text-zinc-500">
                L{level} PRACTITIONER
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
