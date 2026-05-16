'use client';

import { useState, useTransition } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  claimRecommendation,
  linkPrToRec,
  skipRecommendation,
  type RecCard,
} from '@/app/actions/recommendations';
import { sendHelpRequest } from '@/app/actions/help';
import { emitToast } from '@/components/toast';

const PR_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;

const TIER_LABEL: Record<'E' | 'M' | 'H', string> = { E: 'L1', M: 'L2', H: 'L3' };
const TIER_COLOR: Record<'E' | 'M' | 'H', string> = {
  E: 'border-emerald-700 text-emerald-400',
  M: 'border-yellow-700 text-yellow-400',
  H: 'border-red-800 text-red-400',
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
        emitToast({ variant: 'xp', message: `+${rec.xpReward} XP — Issue Claimed` });
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

  if (recs.length === 0) {
    return (
      <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
        No recommendations yet. Check back soon.
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          className="mb-4 border border-red-800 bg-red-900/20 px-4 py-3 text-[11px] uppercase tracking-widest text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}
      <div className="max-h-[520px] overflow-y-auto pr-1 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1">
        <ul>
          {recs.map((rec) => (
            <li key={rec.id} className="border-b border-[#2d333b] py-6 last:border-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_COLOR[rec.difficulty]}`}
                  title={
                    rec.difficulty === 'E'
                      ? 'Easy — good for first-time contributors'
                      : rec.difficulty === 'M'
                        ? 'Medium — requires some codebase familiarity'
                        : rec.difficulty === 'H'
                          ? 'Hard — significant feature or architectural change'
                          : ''
                  }
                >
                  {TIER_LABEL[rec.difficulty]}
                </span>
              </div>

              
                href={rec.url}
                target="_blank"
                rel="noreferrer"
                className="mb-4 flex items-start gap-2 font-serif text-lg leading-snug text-white hover:text-zinc-300"
              >
                {rec.title}
                <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-zinc-500" />
              </a>

              <div className="flex items-center justify-between">
                {rec.status === 'claimed' ? (
                  <ClaimedActions rec={rec} onError={setError} />
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleClaim(rec)}
                      disabled={pending && busyId === rec.id}
                      className="border border-zinc-600 px-4 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyId === rec.id ? 'CLAIMING...' : 'CLAIM'}
                    </button>
                    <button
                      onClick={() => handleSkip(rec)}
                      disabled={pending && busyId === rec.id}
                      className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400 disabled:opacity-40"
                    >
                      SKIP
                    </button>
                  </div>
                )}
                <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-600">
                  +{rec.xpReward} XP
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ClaimedActions({ rec, onError }: { rec: RecCard; onError: (msg: string | null) => void }) {
  const [input, setInput] = useState('');
  const [pending, startTransition] = useTransition();
  const [linked, setLinked] = useState(false);
  const [helpSent, setHelpSent] = useState(false);

  const isValidPrUrl = PR_URL_RE.test(input.trim());

  function onLink() {
    if (!isValidPrUrl) return;
    onError(null);
    startTransition(async () => {
      const res = await linkPrToRec(rec.id, input.trim());
      if (res.ok) setLinked(true);
      else onError(`${rec.title}: ${res.error.message}`);
    });
  }

  function onHelp() {
    if (!input.trim()) {
      onError('Enter a PR URL or describe your issue first.');
      return;
    }
    onError(null);
    startTransition(async () => {
      const res = await sendHelpRequest({ recId: rec.id, prUrl: input.trim() });
      if (res.ok) setHelpSent(true);
      else onError(`${rec.title}: ${res.error.message}`);
    });
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-widest text-purple-400">CLAIMED</span>
        {linked && (
          <span className="border border-emerald-800 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-400">
            PR LINKED
          </span>
        )}
        {helpSent && (
          <span className="border border-amber-800 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-400">
            HELP SENT
          </span>
        )}
      </div>

      {!linked && (
        <>
          <input
            type="text"
            placeholder="PASTE PR URL OR DESCRIBE YOUR ISSUE"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full border border-[#2d333b] bg-[#161b22] px-4 py-2 text-[11px] uppercase tracking-widest text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
          <div className="flex items-center gap-3">
            {isValidPrUrl && (
              <button
                onClick={onLink}
                disabled={pending}
                className="border border-zinc-600 px-4 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? 'LINKING...' : 'LINK PR'}
              </button>
            )}
            {!helpSent && (
              <button
                onClick={onHelp}
                disabled={pending || input.trim().length === 0}
                className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400 disabled:opacity-40"
                title="Request review from L2+ contributors"
              >
                {pending ? 'SENDING...' : 'REQUEST HELP'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}