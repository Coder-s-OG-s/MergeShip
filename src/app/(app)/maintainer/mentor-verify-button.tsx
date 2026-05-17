'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { verifyMentorPr } from '@/app/actions/maintainer';

export function MentorVerifyButton({ prId }: { prId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  function onVerify() {
    setError(null);
    startTransition(async () => {
      const res = await verifyMentorPr(prId);
      if (res.ok) {
        setVerified(true);
        router.refresh();
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {verified ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Verified
        </span>
      ) : (
        <button
          type="button"
          onClick={onVerify}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/70 bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors hover:border-emerald-600 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {pending ? 'Verifying...' : 'Verify'}
        </button>
      )}
      {error && <span className="max-w-40 text-right text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
