'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizonal } from 'lucide-react';
import { postPrComment } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function PrCommentBox({ prId }: { prId: number }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const trimmed = body.trim();

  function handleSubmit() {
    if (trimmed.length === 0 || isPending) return;

    setError(null);
    startTransition(async () => {
      const res = await postPrComment(prId, trimmed);
      if (isOk(res)) {
        setBody('');
        router.refresh();
        return;
      }
      setError(res.error.message);
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <label htmlFor="pr-comment" className="mb-2 block text-sm font-medium text-zinc-200">
        Leave a comment
      </label>
      <textarea
        id="pr-comment"
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (error) setError(null);
        }}
        placeholder="Leave a comment..."
        rows={4}
        className="min-h-28 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm leading-relaxed text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-5 text-sm text-rose-300">{error}</p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={trimmed.length === 0 || isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <SendHorizonal className="h-4 w-4" />
          {isPending ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
