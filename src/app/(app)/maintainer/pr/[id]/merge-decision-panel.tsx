'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPrCiStatus, mergePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { RequestChangesButton } from './request-changes-button';
import { ClosePrButton } from './close-pr-button';
import { GitMerge, X } from 'lucide-react';

type CiStatus = 'passing' | 'failing' | 'pending' | null;
type CheckStatus = 'passing' | 'failing' | 'pending';

function CheckRow({
  label,
  status,
  loading,
}: {
  label: string;
  status: CheckStatus;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 font-mono text-sm">
        <span className="inline-block h-3 w-3 animate-pulse bg-emerald-900/50" />
        <span className="text-emerald-700/50">{label}</span>
      </div>
    );
  }

  const isPassing = status === 'passing';
  const isFailing = status === 'failing';

  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span
        className={`inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm text-[10px] font-bold ${
          isPassing
            ? 'border border-emerald-500 bg-emerald-950/20 text-emerald-400'
            : isFailing
              ? 'border border-rose-500 bg-rose-950/20 text-rose-400'
              : 'border border-zinc-700 bg-transparent text-zinc-600'
        }`}
      >
        {isPassing ? '✓' : isFailing ? <X className="h-3 w-3" strokeWidth={3} /> : ''}
      </span>
      <span
        className={isPassing ? 'text-emerald-400' : isFailing ? 'text-rose-400' : 'text-zinc-500'}
      >
        {label}
      </span>
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
  pipelineStages,
  headSha,
}: {
  prId: number;
  mentorVerified: boolean;
  aiFlagged: boolean;
  installationId: number;
  repoFullName: string;
  prNumber: number;
  pipelineStages?: Array<{
    stageType: string;
    status: string;
    reviewerLevelSnapshot?: number | null;
  }>;
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

  let mentorApprovalLabel = 'Mentor verified';
  let reviewStatus: CheckStatus = mentorVerified ? 'passing' : 'pending';

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

  if (pipelineStages && pipelineStages.length > 0) {
    const mentorStage = pipelineStages.find((s) => s.stageType === 'mentor_approval');
    if (mentorStage) {
      if (mentorStage.status === 'approved') {
        mentorApprovalLabel =
          mentorStage.reviewerLevelSnapshot != null
            ? `Review stages passed (L${mentorStage.reviewerLevelSnapshot})`
            : 'Review stages passed';
        reviewStatus = 'passing';
      } else if (mentorStage.status === 'changes_requested' || mentorStage.status === 'dismissed') {
        mentorApprovalLabel = 'Review stages failed';
        reviewStatus = 'failing';
      } else {
        mentorApprovalLabel = 'Review stages pending';
        reviewStatus = 'pending';
      }
    }
  }

  const allPassing = reviewStatus === 'passing' && !aiFlagged && ciStatus === 'passing';

  return (
    <div>
      <div className="space-y-3">
        <CheckRow label={mentorApprovalLabel} status={reviewStatus} />
        <CheckRow
          label={aiFlagged ? 'AI flags detected' : 'No AI flags detected'}
          status={aiFlagged ? 'failing' : 'passing'}
        />
        <CheckRow label="CI Pipeline Passed" status={ciStatus || 'pending'} loading={ciLoading} />
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
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#34F898] px-4 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-emerald-300 disabled:opacity-50"
        >
          <GitMerge className="h-4 w-4" />
          {merging ? 'Merging...' : 'Merge pull request'}
        </button>
      </div>

      <div className="my-6 border-t border-zinc-800" />

      <div className="flex gap-4">
        <RequestChangesButton prId={prId} />
        <ClosePrButton prId={prId} />
      </div>
    </div>
  );
}
