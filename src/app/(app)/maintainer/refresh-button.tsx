'use client';

import { useState, useTransition } from 'react';
import { refreshMaintainerBackfill } from '@/app/actions/maintainer';

export default function RefreshButton({ installationId }: { installationId: number }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function onClick() {
    setFeedback(null);
    startTransition(async () => {
      const res = await refreshMaintainerBackfill(installationId);
      setFeedback(res.ok ? 'Refresh queued — may take a minute.' : res.error.message);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {feedback && <span className="text-xs text-zinc-400">{feedback}</span>}
      <button
        onClick={onClick}
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
      >
        {pending ? 'Queuing…' : 'Refresh PRs'}
      </button>
    </div>
  );
}
