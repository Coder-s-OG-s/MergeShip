'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestChanges } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function RequestChangesButton({ prId }: { prId: number }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (comment.trim().length === 0) return;
    setLoading(true);
    try {
      const res = await requestChanges(prId, comment);
      if (isOk(res)) {
        setOpen(false);
        setComment('');
        router.refresh();
      } else {
        alert(res.error.message);
      }
    } catch {
      alert('Failed to request changes');
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-sm border border-rose-900/50 px-4 py-2.5 font-mono text-xs text-rose-400 hover:bg-rose-950/30"
      >
        Request changes
      </button>
    );
  }

  return (
    <div className="w-full space-y-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a review comment..."
        rows={4}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setComment('');
          }}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || comment.trim().length === 0}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit →'}
        </button>
      </div>
    </div>
  );
}
