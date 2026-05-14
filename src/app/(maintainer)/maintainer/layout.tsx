import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { getMaintainerInstalls } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { MaintainerNav } from './nav-items';

export default async function MaintainerLayout({ children }: { children: React.ReactNode }) {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const service = getServiceSupabase();
  let handle = '';
  let installLogin = '';
  if (service) {
    const { data: profile } = await service
      .from('profiles')
      .select('github_handle')
      .eq('id', user.id)
      .maybeSingle();
    handle = profile?.github_handle ?? '';
  }
  const installsRes = await getMaintainerInstalls();
  if (isOk(installsRes) && installsRes.data.length > 0) {
    installLogin = installsRes.data[0]!.accountLogin;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117] font-mono text-white">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#30363d] bg-[#0d1117]">
        <div className="p-6 pb-8">
          <div className="text-lg font-bold tracking-wider text-[#00d26a]">MergeShip</div>
          <div className="text-[9px] uppercase tracking-widest text-[#00d26a]/60">
            MAINTAINER CONSOLE
          </div>
        </div>
        <nav className="flex-1 px-3">
          <MaintainerNav />
        </nav>
        <div className="border-t border-[#30363d] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs text-white">
              {handle.substring(0, 2).toUpperCase() || 'M'}
            </div>
            <div className="overflow-hidden">
              <div className="truncate text-[12px] font-bold uppercase">
                {installLogin || handle}
              </div>
              <div className="text-[10px] text-[#00d26a]">MAINTAINER</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
