import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { Sidebar } from './sidebar';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { getMaintainerInstalls } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
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

    if (!mentorHandle) {
      const { data: session } = await service
        .from('mentor_sessions')
        .select('mentor_login')
        .eq('user_id', user.id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      mentorHandle = session?.mentor_login ?? 'priya.codes';
    }
  }

  let isMaintainer = false;
  let installs: MaintainerInstall[] = [];
  try {
    isMaintainer = await isUserMaintainer(user.id);
    if (isMaintainer) {
      const installsRes = await getMaintainerInstalls();
      if (isOk(installsRes)) {
        installs = installsRes.data;
      }
    }
  } catch {
    // never break the layout
  }

  return (
    <ToastProvider initialXp={xp} initialLevel={level}>
      <div className="flex h-screen overflow-hidden bg-[#111318] font-mono text-white">
        <Sidebar
          handle={handle}
          profileHref={`/@${handle}`}
          level={level}
          xp={xp}
          githubTotalMerges={githubTotalMerges}
          githubStreak={githubStreak}
          openIssuesCount={openIssuesCount}
          isMaintainer={isMaintainer}
          mentorHandle={mentorHandle}
          installs={installs}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
