'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function ClosePrButton({ prId }: { prId: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClose() {
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
      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
    >
      {loading ? 'Closing...' : 'Close PR'}
    </button>
  );
}
