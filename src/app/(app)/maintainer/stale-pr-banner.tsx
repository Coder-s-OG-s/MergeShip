'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { isOk, type Result } from '@/lib/result';
import type { StalePrRow } from '@/app/actions/maintainer/analytics';

type PingAction = (prId: number) => Promise<Result<{ commented: boolean }>>;

export function StalePrBanner({
  stalePrs,
  onPing,
}: {
  stalePrs: StalePrRow[];
  onPing: PingAction;
}) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [pinged, setPinged] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const [activePingId, setActivePingId] = useState<number | null>(null);

  const visible = stalePrs.filter((pr) => !dismissed.has(pr.id));

  if (visible.length === 0) return null;

  function dismiss(id: number) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  function handlePing(pr: StalePrRow) {
    setActivePingId(pr.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[pr.id];
      return next;
    });
    startTransition(async () => {
      const res = await onPing(pr.id);
      if (isOk(res)) {
        setPinged((prev) => new Set(prev).add(pr.id));
      } else {
        setErrors((prev) => ({ ...prev, [pr.id]: res.error.message }));
      }
      setActivePingId(null);
    });
  }

  return (
    <div className="mb-6 space-y-2">
      {visible.map((pr) => {
        const hasPinged = pinged.has(pr.id);
        const isThisPending = pending && activePingId === pr.id;
        const error = errors[pr.id];

        return (
          <div
            key={pr.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3"
          >
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0">
                <p className="text-[13px] text-amber-100">
                  <span className="font-mono text-amber-300">
                    {pr.repoFullName} #{pr.number}
                  </span>{' '}
                  has been stalled for{' '}
                  <span className="font-semibold text-amber-300">{pr.daysSinceUpdate} days</span>{' '}
                  waiting on reviewer feedback.
                </p>
                {error && (
                  <p className="mt-1 text-[11px] uppercase tracking-widest text-red-400">{error}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasPinged ? (
                <span className="text-[11px] uppercase tracking-widest text-emerald-400">
                  Pinged ✓
                </span>
              ) : (
                <button
                  onClick={() => handlePing(pr)}
                  disabled={isThisPending || pending}
                  className="text-[11px] uppercase tracking-widest text-amber-300 underline underline-offset-2 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isThisPending ? 'Pinging...' : 'Ping reviewers →'}
                </button>
              )}
              <button
                onClick={() => dismiss(pr.id)}
                className="text-amber-600 hover:text-amber-300"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
