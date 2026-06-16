import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { NavItems } from './nav-items';
import { LogoutButton } from './logout-button';
import { CommandPalette } from '@/components/command-palette';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { ThemeToggle } from './theme-toggle';
import { ToastProvider } from '@/components/toast';

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
  let xp = 0;
  let githubTotalMerges = 0;
  let githubStreak = 0;
  let openIssuesCount = 0;
  let mentorHandle: string | null = null;
  const service = getServiceSupabase();
  if (service) {
    const { data: profile } = await service
      .from('profiles')
      .select('github_handle, level, xp, github_total_merges, github_streak')
      .eq('id', user.id)
      .maybeSingle();
    handle = profile?.github_handle ?? null;
    level = profile?.level ?? 0;
    xp = profile?.xp ?? 0;
    githubTotalMerges = (profile?.github_total_merges as number | null) ?? 0;
    githubStreak = (profile?.github_streak as number | null) ?? 0;

    // Count active issues
    const { count } = await service
      .from('recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['open', 'claimed']);
    openIssuesCount = count ?? 0;

    // Find assigned mentor
    const { data: activeHelp } = await service
      .from('help_requests')
      .select('resolved_by')
      .eq('user_id', user.id)
      .in('status', ['open', 'escalated'])
      .not('resolved_by', 'is', null)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeHelp?.resolved_by) {
      const { data: mentorProfile } = await service
        .from('profiles')
        .select('github_handle')
        .eq('id', activeHelp.resolved_by)
        .maybeSingle();
      mentorHandle = mentorProfile?.github_handle ?? null;
    }
  }

  let isMaintainer = false;
  try {
    isMaintainer = await isUserMaintainer(user.id);
  } catch {
    // never break the layout
  }

  return (
    <ToastProvider initialXp={xp} initialLevel={level}>
      <div className="flex h-screen overflow-hidden bg-[#111318] font-mono text-white">
        {/* Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-[#2d333b] bg-[#111318]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-8 pb-12">
              <Link href="/" className="font-serif text-2xl font-bold tracking-wider text-white">
                MERGESHIP
              </Link>
            </div>

            <div className="mb-4 px-4">
              <CommandPalette />
            </div>

            <nav className="flex flex-col gap-1 px-4">
              <NavItems profileHref={`/@${handle}`} level={level} isMaintainer={isMaintainer} />
            </nav>

            {/* Stats Block */}
            <div className="mx-4 mt-6 grid grid-cols-2 gap-px border border-[#2d333b]">
              <div className="bg-[#161b22] p-3">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500">Total XP</div>
                <div className="mt-1 font-serif text-lg leading-none text-white">
                  {xp.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#161b22] p-3">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500">Merged PRs</div>
                <div className="mt-1 font-serif text-lg leading-none text-white">
                  {githubTotalMerges.toString().padStart(2, '0')}
                </div>
              </div>
              <div className="bg-[#161b22] p-3">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500">
                  Open Issues
                </div>
                <div className="mt-1 font-serif text-lg leading-none text-white">
                  {openIssuesCount.toString().padStart(2, '0')}
                </div>
              </div>
              <div className="bg-[#161b22] p-3">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500">Streak</div>
                <div className="mt-1 font-serif text-lg leading-none text-white">
                  {githubStreak.toString().padStart(2, '0')}
                  <span className="ml-1 text-[9px] text-zinc-500">d</span>
                </div>
              </div>
            </div>

            {/* Mentor Chat */}
            {mentorHandle && (
              <div className="mx-4 mt-4 border border-[#2d333b] p-3">
                <div className="mb-2 text-[9px] uppercase tracking-widest text-zinc-500">
                  Assigned Mentor
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-zinc-800 text-[10px] uppercase text-zinc-400">
                    {mentorHandle.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate text-[11px] font-bold uppercase tracking-widest text-zinc-200">
                    {mentorHandle}
                  </span>
                </div>
                <Link
                  href="/help-inbox"
                  className="flex w-full items-center justify-center border border-[#10b981] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#10b981] transition-colors hover:bg-[#10b981]/10"
                >
                  Open Chat
                </Link>
              </div>
            )}
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
            <ThemeToggle />
            <LogoutButton />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
