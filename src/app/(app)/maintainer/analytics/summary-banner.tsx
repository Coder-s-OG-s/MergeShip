import React from 'react';
import type { AnalyticsStats } from '@/app/actions/maintainer/analytics';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';
import { rangeToPeriodWord } from '@/lib/maintainer/analytics-summary';
import { ShareReportButton } from './share-report-button';

interface SummaryBannerProps {
  stats: AnalyticsStats;
  range: AnalyticsRange;
  installationId: number;
}

export function SummaryBanner({ stats, range, installationId }: SummaryBannerProps) {
  const periodWord = rangeToPeriodWord(range);
  const timeSavedHours = Math.round(stats.maintainerTimeSavedHours?.value ?? 0);
  const prsMerged = stats.prsMerged?.value ?? 0;
  const aiPrsBlocked = stats.aiPrsBlocked?.value ?? 0;
  const contributorsLeveledUp = stats.contributorsLeveledUp?.value ?? 0;

  const hasTimeSaved = timeSavedHours > 0;

  return (
    <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-md border border-[#2d333b] bg-[#0d1117] p-6 text-zinc-100 sm:flex-row sm:items-center">
      <div className="text-base leading-relaxed text-[#c9d1d9]">
        {hasTimeSaved ? (
          <>
            You saved <span className="font-semibold text-emerald-400">{timeSavedHours} hours</span>
            , merged <span className="font-semibold text-emerald-400">{prsMerged} PRs</span>,
            blocked{' '}
            <span className="font-semibold text-emerald-400">{aiPrsBlocked} AI submissions</span>,
            and leveled up{' '}
            <span className="font-semibold text-emerald-400">
              {contributorsLeveledUp} contributors
            </span>{' '}
            {periodWord}.
          </>
        ) : (
          <>
            You merged <span className="font-semibold text-emerald-400">{prsMerged} PRs</span>,
            blocked{' '}
            <span className="font-semibold text-emerald-400">{aiPrsBlocked} AI submissions</span>,
            and leveled up{' '}
            <span className="font-semibold text-emerald-400">
              {contributorsLeveledUp} contributors
            </span>{' '}
            {periodWord}.
          </>
        )}
      </div>
      <div className="shrink-0">
        <ShareReportButton installationId={installationId} range={range} />
      </div>
    </div>
  );
}

export default SummaryBanner;
