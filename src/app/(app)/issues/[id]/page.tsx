import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getIssueById } from '@/app/actions/issues';
import { IssueDetailClient } from './issue-detail-client';

export const dynamic = 'force-dynamic';

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen bg-[#0D0E12] p-12 font-mono text-white">Not configured</div>
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const issueId = parseInt(id, 10);
  if (isNaN(issueId)) {
    return (
      <div className="min-h-screen bg-[#0D0E12] p-12 font-mono text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Invalid issue ID</p>
        </div>
      </div>
    );
  }

  const result = await getIssueById(issueId);

  if (!result.ok) {
    return (
      <div className="min-h-screen bg-[#0D0E12] p-12 font-mono text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">
            {result.error.message}
          </p>
        </div>
      </div>
    );
  }

  return <IssueDetailClient issue={result.data} />;
}
