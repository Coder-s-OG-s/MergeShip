import type { AnalyticsStats } from '@/app/actions/maintainer/analytics';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';

export function rangeToPeriodWord(range: AnalyticsRange): string {
  switch (range) {
    case '7d':
      return 'this week';
    case '30d':
      return 'this month';
    case '90d':
      return 'this quarter';
    case 'all':
      return 'overall';
    default:
      return 'this month';
  }
}

export function buildAnalyticsSummaryText(stats: AnalyticsStats, range: AnalyticsRange): string {
  const period = rangeToPeriodWord(range);
  const timeSavedHours = Math.round(stats.maintainerTimeSavedHours?.value ?? 0);
  const prsMerged = stats.prsMerged?.value ?? 0;
  const aiPrsBlocked = stats.aiPrsBlocked?.value ?? 0;
  const contributorsLeveledUp = stats.contributorsLeveledUp?.value ?? 0;

  if (timeSavedHours > 0) {
    return `You saved ${timeSavedHours} hours, merged ${prsMerged} PRs, blocked ${aiPrsBlocked} AI submissions, and leveled up ${contributorsLeveledUp} contributors ${period}.`;
  }

  return `You merged ${prsMerged} PRs, blocked ${aiPrsBlocked} AI submissions, and leveled up ${contributorsLeveledUp} contributors ${period}.`;
}
