'use client';

import { useState, useTransition } from 'react';
import {
  claimRecommendation,
  skipRecommendation,
  type RecCard,
} from '@/app/actions/recommendations';

const TIER_LABEL: Record<'E' | 'M' | 'H', string> = { E: 'Easy', M: 'Medium', H: 'Hard' };
const TIER_COLOR: Record<'E' | 'M' | 'H', string> = {
  E: 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-700/40',
  M: 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-700/40',
  H: 'bg-rose-900/40 text-rose-300 ring-1 ring-rose-700/40',
};

export default function RecCards({ recs: initial }: { recs: RecCard[] }) {
  const [recs, setRecs] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClaim(rec: RecCard) {
    setBusyId(rec.id);
    setError(null);
    startTransition(async () => {
      const res = await claimRecommendation(rec.id);
      if (res.ok) {
        setRecs((prev) => prev.map((r) => (r.id === rec.id ? { ...r, status: 'claimed' } : r)));
      } else {
        setError(`${rec.title}: ${res.error.message}`);
      }
      setBusyId(null);
    });
  }

  function handleSkip(rec: RecCard) {
    setBusyId(rec.id);
    setError(null);
    startTransition(async () => {
      const res = await skipRecommendation(rec.id);
      if (res.ok) {
        setRecs((prev) => prev.filter((r) => r.id !== rec.id));
      } else {
        setError(`${rec.title}: ${res.error.message}`);
      }
      setBusyId(null);
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-3 text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {recs.map((rec) => (
          <li
            key={rec.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <a
                href={rec.url}
                target="_blank"
                rel="noreferrer"
                className="font-display text-base font-semibold text-white hover:underline"
              >
                {rec.title}
              </a>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLOR[rec.difficulty]}`}
              >
                {TIER_LABEL[rec.difficulty]} · +{rec.xpReward} XP
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {rec.repoFullName} · #{rec.issueNumber}
            </p>

            <div className="mt-4 flex gap-2">
              {rec.status === 'claimed' ? (
                <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
                  Claimed — open your PR on GitHub
                </span>
              ) : (
                <>
                  <button
                    onClick={() => handleClaim(rec)}
                    disabled={pending && busyId === rec.id}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    {busyId === rec.id ? 'Claiming…' : 'Claim'}
                  </button>
                  <button
                    onClick={() => handleSkip(rec)}
                    disabled={pending && busyId === rec.id}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
