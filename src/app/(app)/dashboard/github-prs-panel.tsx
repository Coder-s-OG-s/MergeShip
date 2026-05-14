'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { GitHubPR } from '@/app/actions/github-sync';

type Props = {
  prs: GitHubPR[];
  claimedPrUrls: string[];
  githubHandle: string;
};

type Filter = 'open' | 'closed' | 'merged';

export function GitHubPRsPanel({ prs, claimedPrUrls, githubHandle }: Props) {
  const [filter, setFilter] = useState<Filter>('open');
  const claimedSet = new Set(claimedPrUrls);

  const filtered = prs.filter((pr) => pr.state === filter).slice(0, 5);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
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

      <div className="space-y-6">
        {filtered.length === 0 ? (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            No {filter} PRs.
          </div>
        ) : (
          filtered.map((pr) => (
            <div key={pr.id} className="border-b border-[#2d333b] pb-6 last:border-0">
              <Link href={pr.url} target="_blank" rel="noopener noreferrer">
                <h3 className="mb-1 text-[15px] text-white hover:underline">{pr.title}</h3>
              </Link>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">
                #{pr.number} · {pr.repo_full_name} · {formatDate(pr.github_created_at)}
              </div>
              <div className="flex items-center gap-3">
                <StateBadge state={pr.state} />
                {claimedSet.has(pr.url) && (
                  <span className="border border-purple-700 bg-purple-900/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-300">
                    CLAIMED
                  </span>
                )}
              </div>
            </div>
          ))
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
