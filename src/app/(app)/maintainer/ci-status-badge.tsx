'use client';

import { useEffect, useState } from 'react';
import { getPrCiStatus } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

type CiState = 'passing' | 'failing' | 'pending' | null;

export default function CiStatusBadge({
  installationId,
  repoFullName,
  prNumber,
}: {
  installationId: number;
  repoFullName: string;
  prNumber: number;
}) {
  const [status, setStatus] = useState<CiState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchStatus() {
      const res = await getPrCiStatus(installationId, repoFullName, prNumber);
      if (active && isOk(res)) {
        setStatus(res.data);
      }
      if (active) {
        setLoading(false);
      }
    }
    fetchStatus();
    return () => {
      active = false;
    };
  }, [installationId, repoFullName, prNumber]);

  if (loading) {
    return (
      <span
        className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-800"
        aria-hidden="true"
      />
    );
  }

  if (status === 'passing') {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-950/40 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30"
        title="CI Passing"
      >
        ✓
      </span>
    );
  }

  if (status === 'failing') {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-950/40 text-xs font-semibold text-rose-400 ring-1 ring-rose-500/30"
        title="CI Failing"
      >
        ✗
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-zinc-400 ring-1 ring-zinc-700/40"
        title="CI Pending"
      >
        ●
      </span>
    );
  }

  return null;
}
