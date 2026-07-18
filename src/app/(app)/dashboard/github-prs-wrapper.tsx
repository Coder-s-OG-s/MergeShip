import { getServiceSupabase } from '@/lib/supabase/service';
import { GitHubPRsPanel } from './github-prs-panel';
import type { GitHubPR } from '@/app/actions/github-sync';

export default async function GitHubPRsWrapper({
  userId,
  githubHandle,
}: {
  userId: string;
  githubHandle: string;
}) {
  const service = getServiceSupabase();
  if (!service) return null;

  // Query pull_requests directly (populated by webhooks)
  const { data: prsData } = await service
    .from('pull_requests')
    .select(
      `
      id,
      github_pr_id,
      repo_full_name,
      number,
      title,
      state,
      url,
      github_created_at,
      merged_at,
      pull_request_reviews ( state )
    `,
    )
    .eq('author_user_id', userId)
    .order('github_created_at', { ascending: false });

  const prs = (prsData ?? []) as any;

  // Active Issues: claimed recommendations only
  const { data: claimedRecs } = await service
    .from('recommendations')
    .select(
      `
      id,
      status,
      xp_reward,
      linked_pr_url,
      difficulty,
      issues (
        title,
        repo_full_name,
        url
      )
    `,
    )
    .eq('user_id', userId)
    .eq('status', 'claimed')
    .limit(2);

  const claimedPrUrls = (claimedRecs ?? [])
    .map((r: any) => r.linked_pr_url)
    .filter(Boolean) as string[];

  return <GitHubPRsPanel prs={prs} claimedPrUrls={claimedPrUrls} githubHandle={githubHandle} />;
}

export function PrsSkeleton() {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">MY PRS</h2>
        <div className="flex gap-4">
          <div className="h-7 w-20 animate-pulse bg-zinc-800" />
          <div className="h-4 w-16 animate-pulse bg-zinc-800" />
        </div>
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-b border-[#2d333b] pb-6 last:border-0">
            <div className="mb-2 h-5 w-3/4 animate-pulse bg-zinc-800" />
            <div className="mb-3 h-3 w-1/2 animate-pulse bg-zinc-800" />
            <div className="h-5 w-16 animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
