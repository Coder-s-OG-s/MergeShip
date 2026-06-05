import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { NavItems } from './nav-items';
import { LogoutButton } from './logout-button';
import { CommandPalette } from '@/components/command-palette';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { ThemeToggle } from './theme-toggle';
import { AppNavbar } from './app-navbar';
import './app-shell.css';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await getServerSupabase();
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#111110] text-[#f2f0eb]">
      <AppNavbar handle={handle} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="app-sidebar relative flex w-64 shrink-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-3 pb-3 pt-4 lg:hidden">
              <CommandPalette variant="sidebar" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1">
              <p className="app-nav-section">• FOR CONTRIBUTORS</p>
              <nav className="flex flex-col gap-0.5">
                <NavItems profileHref={`/@${handle}`} level={level} isMaintainer={isMaintainer} />
              </nav>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#ddd9d0] px-3 py-4">
            <div className="mb-3 flex items-center gap-2.5 px-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#111110]">
                <span
                  className="text-[11px] font-medium text-[#f2f0eb]"
                  style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
                >
                  {handle?.substring(0, 2).toUpperCase() ?? 'NA'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[13px] font-medium tracking-[-0.01em] text-[#111110]"
                  style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                >
                  {handle || 'Contributor'}
                </div>
                <div
                  className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#16a34a]"
                  style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
                >
                  LVL {level}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="app-shell min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
