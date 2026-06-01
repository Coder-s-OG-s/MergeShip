'use client';

import { useState, useTransition } from 'react';
import { verifyPrAction } from '@/app/actions/mentor';
import { CheckCircle } from 'lucide-react';

export function VerifyButton({ prId, prUrl }: { prId?: number; prUrl?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleVerify() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await verifyPrAction({ prId, prUrl });
      if (res.ok) {
        setSuccess(`Verified! +${res.data.xpAwarded} XP`);
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleVerify}
        disabled={pending || success !== null}
        className="flex items-center gap-1 rounded border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-1 text-[10px] uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-900/40 disabled:opacity-50"
      >
        <CheckCircle className="h-3 w-3" />
        {pending ? 'Verifying...' : success ? 'Verified' : 'Verify'}
      </button>
      {error && <span className="text-[10px] uppercase tracking-widest text-red-400">{error}</span>}
      {success && !pending && (
        <span className="text-[10px] uppercase tracking-widest text-emerald-400">{success}</span>
      )}
    </div>
  );
}
