'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPrCiStatus, mergePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { RequestChangesButton } from './request-changes-button';
import { ClosePrButton } from './close-pr-button';
import { GitMerge } from 'lucide-react';

type CiStatus = 'passing' | 'failing' | 'pending' | null;

function CheckRow({ label, pass, loading }: { label: string; pass: boolean; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 font-mono text-sm">
        <span className="inline-block h-3 w-3 animate-pulse bg-emerald-900/50" />
        <span className="text-emerald-700/50">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span
        className={`inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm text-[10px] font-bold ${
          pass
            ? 'border border-emerald-500 bg-emerald-950/20 text-emerald-400'
            : 'border border-zinc-700 bg-transparent text-zinc-600'
        }`}
      >
        {pass ? '✓' : ''}
      </span>
      <span className={pass ? 'text-emerald-400' : 'text-zinc-500'}>{label}</span>
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
}) {
  const [ciStatus, setCiStatus] = useState<CiStatus>(null);
  const [ciLoading, setCiLoading] = useState(true);
  const [merging, setMerging] = useState(false);
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
      const res = await mergePullRequest(prId);
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

  let mentorApprovalLabel = 'Mentor verified';
  if (pipelineStages && pipelineStages.length > 0) {
    const mentorStage = pipelineStages.find(
      (s) => s.stageType === 'mentor_approval' && s.status === 'approved',
    );
    if (mentorStage) {
      mentorApprovalLabel =
        mentorStage.reviewerLevelSnapshot != null
          ? `Review stages passed (L${mentorStage.reviewerLevelSnapshot})`
          : 'Review stages passed';
    } else {
      mentorApprovalLabel = 'Review stages pending';
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <CheckRow label={mentorApprovalLabel} pass={mentorVerified} />
        <CheckRow label="No AI flags detected" pass={!aiFlagged} />
        <CheckRow label="CI Pipeline Passed" pass={ciStatus === 'passing'} loading={ciLoading} />
      </div>

      <button
        onClick={handleMerge}
        disabled={!allPassing || merging}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-[#34F898] px-4 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-emerald-300 disabled:opacity-50"
      >
        <GitMerge className="h-4 w-4" />
        {merging ? 'Merging...' : 'Merge pull request'}
      </button>

      <div className="my-6 border-t border-zinc-800" />

      <div className="flex gap-4">
        <RequestChangesButton prId={prId} />
        <ClosePrButton prId={prId} />
      </div>
    </div>
  );
}
