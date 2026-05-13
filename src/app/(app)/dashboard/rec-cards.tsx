'use client';

import { useState, useTransition } from 'react';
import {
  claimRecommendation,
  linkPrToRec,
  skipRecommendation,
  type RecCard,
} from '@/app/actions/recommendations';
import { sendHelpRequest } from '@/app/actions/help';

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
        setRecs((prev) => {
          const without = prev.filter((r) => r.id !== rec.id);
          return res.data.replacement ? [...without, res.data.replacement] : without;
        });
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
                <ClaimedActions rec={rec} onError={setError} />
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

function ClaimedActions({ rec, onError }: { rec: RecCard; onError: (msg: string | null) => void }) {
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [linked, setLinked] = useState(false);
  const [helpSent, setHelpSent] = useState(false);

  function onLink() {
    onError(null);
    startTransition(async () => {
      const res = await linkPrToRec(rec.id, url);
      if (res.ok) setLinked(true);
      else onError(`${rec.title}: ${res.error.message}`);
    });
  }

  function onHelp() {
    if (!url) {
      onError('Paste your PR URL first.');
      return;
    }
    onError(null);
    startTransition(async () => {
      const res = await sendHelpRequest({ recId: rec.id, prUrl: url });
      if (res.ok) setHelpSent(true);
      else onError(`${rec.title}: ${res.error.message}`);
    });
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {linked ? (
        <span className="rounded-lg bg-emerald-900/40 px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-700/40">
          PR linked
        </span>
      ) : (
        <span className="text-xs text-zinc-400">Claimed.</span>
      )}
      <input
        type="url"
        placeholder="https://github.com/owner/repo/pull/123"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600"
      />
      {!linked && (
        <button
          onClick={onLink}
          disabled={pending || url.length === 0}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {pending ? 'Linking…' : 'Link PR'}
        </button>
      )}
      {helpSent ? (
        <span className="rounded-lg bg-amber-900/40 px-2 py-1 text-xs text-amber-300 ring-1 ring-amber-700/40">
          Help sent
        </span>
      ) : (
        <button
          onClick={onHelp}
          disabled={pending || url.length === 0}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
          title="Ping L2+ contributors to review your PR"
        >
          Help
        </button>
      )}
    </div>
  );
}
