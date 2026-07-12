'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function ClosePrButton({ prId }: { prId: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClose() {
    if (!confirm('Are you sure you want to close this pull request?')) return;
    setLoading(true);
    try {
      const res = await closePullRequest(prId);
      if (isOk(res)) {
        router.push('/maintainer');
      } else {
        alert(res.error.message);
        setLoading(false);
      }
    } catch {
      alert('Failed to close PR');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClose}
      disabled={loading}
      className="rounded-sm border border-zinc-800/80 px-4 py-2.5 font-mono text-xs text-zinc-400 hover:bg-zinc-800/30 disabled:opacity-50"
    >
      {loading ? 'Closing...' : 'Close PR'}
    </button>
  );
}
