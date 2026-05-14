import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';

export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
        <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
          Issue Tracking
        </p>
      </div>
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <p className="text-[13px] text-zinc-500">Issue management coming soon.</p>
      </div>
    </div>
  );
}
