'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { XOctagon } from 'lucide-react';

export function ClosePrButton({ prId }: { prId: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClose() {
    if (!confirm('Are you sure you want to close this pull request?')) return;
    setLoading(true);
    try {
      const res = await closePullRequest(prId);
      if (isOk(res)) {
        router.refresh();
      } else {
        alert(res.error.message);
        setLoading(false);
      }
    } catch (e) {
      alert('Failed to close PR');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClose}
      disabled={loading}
      className="flex items-center gap-1.5 rounded border border-rose-700/50 bg-rose-900/20 px-2.5 py-1 text-[10px] uppercase tracking-widest text-rose-400 transition-colors hover:bg-rose-900/40 disabled:opacity-50"
    >
      <XOctagon className="h-3 w-3" />
      {loading ? 'Closing...' : 'Close PR'}
    </button>
  );
}
