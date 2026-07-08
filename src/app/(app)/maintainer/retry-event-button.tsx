'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryFailedWebhookEvent } from '@/app/actions/maintainer';

export function RetryEventButton({
  eventId,
  installationId,
}: {
  eventId: number;
  installationId: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="inline-flex items-center gap-2">
      <button
        disabled={isPending}
        className="rounded border border-zinc-700 px-2 py-1 text-[10px] uppercase tracking-widest text-zinc-400 transition-colors hover:border-emerald-700 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await retryFailedWebhookEvent({ eventId, installationId });
            if (!res.ok) {
              setError(res.error.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        {isPending ? 'Retrying…' : 'Retry'}
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
