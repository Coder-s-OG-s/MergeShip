'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPrCiStatus, mergePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { RequestChangesButton } from './request-changes-button';
import { ClosePrButton } from './close-pr-button';

type CiStatus = 'passing' | 'failing' | 'pending' | null;

function CheckRow({ label, pass, loading }: { label: string; pass: boolean; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
        <span className="text-zinc-400">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
          pass
            ? 'bg-emerald-950/40 text-emerald-400 ring-1 ring-emerald-500/30'
            : 'bg-rose-950/40 text-rose-400 ring-1 ring-rose-500/30'
        }`}
      >
        {pass ? '✓' : '✗'}
      </span>
      <span className={pass ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span>
    </div>
  );
}

export function MergeDecisionPanel({
  prId,
  mentorVerified,
  aiFlagged,
  installationId,
  repoFullName,
  prNumber,
  headSha,
}: {
  prId: number;
  mentorVerified: boolean;
  aiFlagged: boolean;
  installationId: number;
  repoFullName: string;
  prNumber: number;
  headSha?: string;
}) {
  const [ciStatus, setCiStatus] = useState<CiStatus>(null);
  const [ciLoading, setCiLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<'squash' | 'merge' | 'rebase'>('squash');
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function fetchCi() {
      const res = await getPrCiStatus(installationId, repoFullName, prNumber);
      if (active && isOk(res)) setCiStatus(res.data);
      if (active) setCiLoading(false);
    }
    fetchCi();
    return () => {
      active = false;
    };
  }, [installationId, repoFullName, prNumber]);

  const allPassing = mentorVerified && !aiFlagged && ciStatus === 'passing';

  async function handleMerge() {
    setMerging(true);
    try {
      const res = await mergePullRequest(prId, { mergeMethod, expectedHeadSha: headSha });
      if (isOk(res)) {
        setMerging(false);
        router.push('/maintainer');
      } else {
        alert(res.error.message);
        setMerging(false);
      }
    } catch {
      alert('Failed to merge PR');
      setMerging(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <CheckRow label="Mentor verified" pass={mentorVerified} />
        <CheckRow label="No AI flags detected" pass={!aiFlagged} />
        <CheckRow label="CI Pipeline Passed" pass={ciStatus === 'passing'} loading={ciLoading} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <select
          value={mergeMethod}
          onChange={(e) => setMergeMethod(e.target.value as any)}
          disabled={!allPassing || merging}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        >
          <option value="squash">Squash and merge</option>
          <option value="merge">Create a merge commit</option>
          <option value="rebase">Rebase and merge</option>
        </select>
        <button
          onClick={handleMerge}
          disabled={!allPassing || merging}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {merging ? 'Merging...' : 'Merge PR ↑'}
        </button>
      </div>

      <div className="my-4 border-t border-zinc-800" />

      <div className="flex flex-wrap gap-3">
        <RequestChangesButton prId={prId} />
        <ClosePrButton prId={prId} />
      </div>
    </div>
  );
}
