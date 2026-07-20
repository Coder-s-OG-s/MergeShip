import React from 'react';
import type { AnalyticsStats, AnalyticsStat } from '@/app/actions/maintainer';

interface StatsHeaderProps {
  stats: AnalyticsStats;
}

function DeltaIndicator({ stat }: { stat: AnalyticsStat }) {
  if (stat.delta === 0) return null;
  const isPositive = stat.delta > 0;

  // Good if (positive delta AND positive is good) OR (negative delta AND positive is NOT good)
  const isGood =
    (isPositive && stat.deltaPositiveIsGood) || (!isPositive && !stat.deltaPositiveIsGood);
  const colorClass = isGood ? 'text-green-500' : 'text-red-500';
  const arrow = isPositive ? '↗' : '↘';
  const sign = isPositive ? '+' : '';

  return (
    <span className={`text-sm font-medium ${colorClass} flex items-center gap-1`}>
      {arrow} {sign}
      {stat.delta}
    </span>
  );
}

function DeltaIndicatorHours({ stat }: { stat: AnalyticsStat }) {
  if (stat.delta === 0) return null;
  const isPositive = stat.delta > 0;

  // Good if (positive delta AND positive is good) OR (negative delta AND positive is NOT good)
  const isGood =
    (isPositive && stat.deltaPositiveIsGood) || (!isPositive && !stat.deltaPositiveIsGood);
  const colorClass = isGood ? 'text-green-500' : 'text-red-500';
  const arrow = isPositive ? '↗' : '↘';
  const sign = isPositive ? '+' : '';

  return (
    <span className={`text-sm font-medium ${colorClass} flex items-center gap-1`}>
      {arrow} {sign}
      {stat.delta.toFixed(1)}h
    </span>
  );
}

function DeltaIndicatorPercent({ stat }: { stat: AnalyticsStat }) {
  if (stat.delta === 0) return null;
  const isPositive = stat.delta > 0;

  // Good if (positive delta AND positive is good) OR (negative delta AND positive is NOT good)
  const isGood =
    (isPositive && stat.deltaPositiveIsGood) || (!isPositive && !stat.deltaPositiveIsGood);
  const colorClass = isGood ? 'text-green-500' : 'text-red-500';
  const arrow = isPositive ? '↗' : '↘';
  const sign = isPositive ? '+' : '';

  return (
    <span className={`text-sm font-medium ${colorClass} flex items-center gap-1`}>
      {arrow} {sign}
      {stat.delta.toFixed(0)}%
    </span>
  );
}

export function StatsHeader({ stats }: StatsHeaderProps) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {/* PRS MERGED */}
      <div className="flex flex-col justify-between rounded-xl border border-[#2d333b] bg-[#161b22] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">PRS MERGED</div>
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-3xl text-zinc-100">{stats.prsMerged.value}</div>
          <DeltaIndicator stat={stats.prsMerged} />
        </div>
      </div>

      {/* AVG REVIEW TIME */}
      <div className="flex flex-col justify-between rounded-xl border border-[#2d333b] bg-[#161b22] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">
          AVG REVIEW TIME
        </div>
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-3xl text-zinc-100">
            {stats.avgReviewTimeHours.value > 0
              ? `${stats.avgReviewTimeHours.value.toFixed(1)}h`
              : '0h'}
          </div>
          <DeltaIndicatorHours stat={stats.avgReviewTimeHours} />
        </div>
      </div>

      {/* QUEUE SIGNAL RATE */}
      <div className="flex flex-col justify-between rounded-xl border border-[#2d333b] bg-[#161b22] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">
          QUEUE SIGNAL RATE
        </div>
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-3xl text-zinc-100">
            {stats.queueSignalRate.value.toFixed(0)}%
          </div>
          <DeltaIndicatorPercent stat={stats.queueSignalRate} />
        </div>
      </div>

      {/* AI PRS BLOCKED */}
      <div className="flex flex-col justify-between rounded-xl border border-[#2d333b] bg-[#161b22] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">
          AI PRS BLOCKED
        </div>
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-3xl text-zinc-100">{stats.aiPrsBlocked.value}</div>
          <DeltaIndicator stat={stats.aiPrsBlocked} />
        </div>
      </div>

      {/* CONTRIBUTORS LEVELED UP */}
      <div className="flex flex-col justify-between rounded-xl border border-[#2d333b] bg-[#161b22] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">
          CONTRIBUTORS LEVELED UP
        </div>
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-3xl text-zinc-100">
            {stats.contributorsLeveledUp.value}
          </div>
          <DeltaIndicator stat={stats.contributorsLeveledUp} />
        </div>
      </div>

      {/* MAINTAINER TIME SAVED */}
      <div className="flex flex-col justify-between rounded-xl border border-[#2d333b] bg-emerald-950/20 p-4 ring-1 ring-emerald-500/20">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-emerald-500/80">
          MAINTAINER TIME SAVED
        </div>
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-3xl text-emerald-400">
            {stats.maintainerTimeSavedHours.value > 0
              ? `${Math.round(stats.maintainerTimeSavedHours.value)}h`
              : '-'}
          </div>
          {stats.maintainerTimeSavedHours.value > 0 && (
            <DeltaIndicatorHours
              stat={{
                ...stats.maintainerTimeSavedHours,
                delta: Math.round(stats.maintainerTimeSavedHours.delta),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
