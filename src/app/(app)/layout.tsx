import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { LogOut } from 'lucide-react';
import { NavItems } from './nav-items';

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
    <div className="flex h-screen overflow-hidden bg-[#111318] font-mono text-white">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-[#2d333b] bg-[#111318]">
        <div>
          <div className="p-8 pb-12">
            <Link href="/dashboard" className="font-serif text-2xl font-bold tracking-wider text-white">
              MERGESHIP
            </Link>
          </div>

          <nav className="flex flex-col gap-1 px-4">
            <NavItems profileHref={`/@${handle}`} />
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
          <button className="flex w-full items-center gap-3 text-[13px] tracking-widest text-zinc-400 transition-colors hover:text-white">
            <LogOut className="h-4 w-4" />
            LOGOUT
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
