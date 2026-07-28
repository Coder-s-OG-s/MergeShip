'use client';

import type { TimeSavedBreakdown, AnalyticsRange } from '@/lib/maintainer/time-saved';
import Link from 'next/link';

interface TimeSavedPanelProps {
  breakdown: TimeSavedBreakdown;
  installationId: number;
  range: AnalyticsRange;
}

export default function TimeSavedPanel({ breakdown, installationId, range }: TimeSavedPanelProps) {
  const { aiFilteringHours, chainReviewsHours, autoTriageHours, totalHours, projectedAnnualHours } =
    breakdown;

  const rangeText =
    range === '7d'
      ? 'THIS WEEK'
      : range === '30d'
        ? 'THIS MONTH'
        : range === '90d'
          ? 'THIS QUARTER'
          : 'ALL TIME';

  if (totalHours === 0) {
    return (
      <div className="flex min-h-[300px] flex-col justify-between rounded-xl border border-zinc-800 bg-[#161b22] p-5">
        <div>
          <div className="mb-4 text-[10px] uppercase tracking-widest text-zinc-500">
            TIME SAVED {rangeText}
          </div>
          <p className="mt-8 text-sm leading-relaxed text-zinc-400">
            Enable{' '}
            <Link
              href={`/maintainer?install=${installationId}`}
              className="font-semibold text-emerald-400 hover:underline"
            >
              AI Detection
            </Link>{' '}
            and{' '}
            <Link
              href={`/maintainer?install=${installationId}`}
              className="font-semibold text-emerald-400 hover:underline"
            >
              mentor chain
            </Link>{' '}
            to start saving time.
          </p>
        </div>
      </div>
    );
  }

  // Format hero number: if it's integer, no decimal places, otherwise 1 decimal place
  const formattedHero = totalHours % 1 === 0 ? totalHours.toFixed(0) : totalHours.toFixed(1);

  return (
    <div className="flex min-h-[320px] flex-col justify-between rounded-xl border border-zinc-800 bg-[#161b22] p-5">
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">
          TIME SAVED {rangeText}
        </div>
        <div className="mb-6 font-serif text-5xl text-emerald-400">{formattedHero}h</div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">AI Filtering</span>
            <span className="font-mono text-white">{aiFilteringHours.toFixed(1)}h</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Chain Reviews</span>
            <span className="font-mono text-white">{chainReviewsHours.toFixed(1)}h</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Auto-Triage</span>
            <span className="font-mono text-white">{autoTriageHours.toFixed(1)}h</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-xs font-semibold text-zinc-950 shadow-lg shadow-emerald-950/20 transition-colors hover:bg-emerald-600 active:bg-emerald-700"
        >
          Projected: {projectedAnnualHours}h saved per year
        </button>
      </div>
    </div>
  );
}
