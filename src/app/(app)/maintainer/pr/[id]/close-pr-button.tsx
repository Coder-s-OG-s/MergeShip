'use client';

import { useState, useTransition } from 'react';
import { closePullRequest } from '@/app/actions/maintainer';
import { Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ClosePrButton({ prId }: { prId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClose() {
    if (!confirm('Are you sure you want to close this pull request on GitHub?')) return;
    setError(null);
    startTransition(async () => {
      const res = await closePullRequest(prId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClose}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/40 active:scale-[0.98] disabled:opacity-50"
      >
        <Ban className="h-4 w-4" />
        {pending ? 'Closing...' : 'Close PR'}
      </button>
      {error && <span className="text-[10px] uppercase tracking-widest text-red-400">{error}</span>}
    </div>
  );
}
