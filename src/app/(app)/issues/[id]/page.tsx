import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { getIssueDetail } from '@/app/actions/issues';
import { isOk } from '@/lib/result';
import { IssueDetailClient } from './issue-detail-client';

export const dynamic = 'force-dynamic';

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issueId = parseInt(id, 10);
  if (isNaN(issueId)) redirect('/issues');

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

  const service = getServiceSupabase();

  let currentUserLevel = 0;
  let currentUserHandle: string | null = null;
  let currentUserAvatar: string | null = null;
  if (service) {
    const { data: profile } = await service
      .from('profiles')
      .select('level, github_handle')
      .eq('id', user.id)
      .maybeSingle();
    if (profile) {
      currentUserLevel = profile.level ?? 0;
      currentUserHandle = profile.github_handle;
    }
    const identity = user.identities?.find((i) => i.provider === 'github');
    currentUserAvatar = (identity?.identity_data?.['avatar_url'] as string) ?? null;
  }

  const result = await getIssueDetail(issueId);
  if (!isOk(result)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0E12] font-mono text-white">
        <div className="text-4xl text-zinc-600">404</div>
        <div className="mt-2 text-sm text-zinc-500">Issue not found</div>
      </div>
    );
  }

  return (
    <IssueDetailClient
      issue={result.data}
      currentUserLevel={currentUserLevel}
      currentUserHandle={currentUserHandle}
      currentUserAvatar={currentUserAvatar}
    />
  );
}
