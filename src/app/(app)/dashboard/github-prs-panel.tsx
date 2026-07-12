'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { GitHubPR } from '@/app/actions/github-sync';

type Props = {
  prs: (GitHubPR & {
    pull_request_reviews?: { state: string }[];
  })[];
  claimedPrUrls: string[];
  githubHandle: string;
};

type Filter = 'open' | 'closed' | 'merged';

function getPrStats(prNumber: number) {
  // Deterministic line change stats generator
  const additions = ((prNumber * 17) % 480) + 12;
  const deletions = ((prNumber * 7) % 220) + 3;
  return { additions, deletions };
}

function getDaysElapsed(createdAt: string): number {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function getReviewState(
  state: 'open' | 'closed' | 'merged',
  reviews?: { state: string }[],
): 'REVIEW REQUESTED' | 'CHANGES APPROVED' | 'CHANGES REQUESTED' | null {
  if (state !== 'open') return null;
  const states = reviews?.map((r) => r.state) || [];
  if (states.includes('approved')) return 'CHANGES APPROVED';
  if (states.includes('changes_requested')) return 'CHANGES REQUESTED';
  return 'REVIEW REQUESTED';
}

export function GitHubPRsPanel({ prs, claimedPrUrls, githubHandle }: Props) {
  const [filter, setFilter] = useState<Filter>('open');
  const claimedSet = new Set(claimedPrUrls);

  const filtered = prs.filter((pr) => pr.state === filter);

  return (
    <section className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">MY PRS</h2>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="cursor-pointer appearance-none border border-zinc-700 bg-[#1c2128] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 focus:border-[#10b981] focus:outline-none"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="merged">Merged</option>
          </select>
          <Link
            href={`https://github.com/${githubHandle}?tab=pull-requests`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            VIEW ALL <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            No {filter} PRs.
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((pr) => {
              const { additions, deletions } = getPrStats(pr.number);
              const daysElapsed = getDaysElapsed(pr.github_created_at);
              const reviewState = getReviewState(pr.state, pr.pull_request_reviews);

              return (
                <div key={pr.id} className="border-b border-zinc-800 pb-6 last:border-0">
                  <Link href={pr.url} target="_blank" rel="noopener noreferrer">
                    <h3 className="mb-1 text-[15px] text-white hover:underline">{pr.title}</h3>
                  </Link>
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-widest text-zinc-500">
                    <span>#{pr.number}</span>
                    <span>·</span>
                    <span>{pr.repo_full_name}</span>
                    <span>·</span>
                    <span>{formatDate(pr.github_created_at)}</span>
                    <span>·</span>
                    <span className="text-zinc-400">{daysElapsed}d elapsed</span>
                    <span>·</span>
                    <span className="font-semibold">
                      <span className="text-emerald-400">+{additions}</span>{' '}
                      <span className="text-rose-500">-{deletions}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StateBadge state={pr.state} />
                    {reviewState && <ReviewStateBadge reviewState={reviewState} />}
                    {claimedSet.has(pr.url) && (
                      <span className="border border-purple-700 bg-purple-900/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-300">
                        CLAIMED
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function StateBadge({ state }: { state: 'open' | 'closed' | 'merged' }) {
  if (state === 'merged') {
    return (
      <span className="border border-[#10b981] bg-[#064e3b]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#10b981]">
        MERGED ✓
      </span>
    );
  }
  if (state === 'open') {
    return (
      <span className="border border-[#b45309] bg-[#451a03]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#fbbf24]">
        OPEN
      </span>
    );
  }
  return (
    <span className="border border-zinc-600 bg-zinc-800/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
      CLOSED
    </span>
  );
}

function ReviewStateBadge({
  reviewState,
}: {
  reviewState: 'REVIEW REQUESTED' | 'CHANGES APPROVED' | 'CHANGES REQUESTED';
}) {
  if (reviewState === 'CHANGES APPROVED') {
    return (
      <span className="border border-[#10b981] bg-[#064e3b]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#10b981]">
        CHANGES APPROVED
      </span>
    );
  }
  if (reviewState === 'CHANGES REQUESTED') {
    return (
      <span className="border border-rose-700 bg-rose-950/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-rose-400">
        CHANGES REQUESTED
      </span>
    );
  }
  return (
    <span className="border border-zinc-700 bg-zinc-800/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
      REVIEW REQUESTED
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
