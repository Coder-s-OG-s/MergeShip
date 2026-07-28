import { describe, it, expect } from 'vitest';
import { buildAnalyticsSummaryText, rangeToPeriodWord } from './analytics-summary';
import type { AnalyticsStats } from '@/app/actions/maintainer/analytics';

const mockStats: AnalyticsStats = {
  prsMerged: { value: 38, delta: 5, deltaPositiveIsGood: true },
  avgReviewTimeHours: { value: 4.2, delta: -0.5, deltaPositiveIsGood: false },
  queueSignalRate: { value: 85, delta: 2, deltaPositiveIsGood: true },
  aiPrsBlocked: { value: 14, delta: 3, deltaPositiveIsGood: true },
  contributorsLeveledUp: { value: 6, delta: 1, deltaPositiveIsGood: true },
  maintainerTimeSavedHours: { value: 22, delta: 4, deltaPositiveIsGood: true },
};

describe('rangeToPeriodWord', () => {
  it('returns correct period words for ranges', () => {
    expect(rangeToPeriodWord('7d')).toBe('this week');
    expect(rangeToPeriodWord('30d')).toBe('this month');
    expect(rangeToPeriodWord('90d')).toBe('this quarter');
    expect(rangeToPeriodWord('all')).toBe('overall');
  });
});

describe('buildAnalyticsSummaryText', () => {
  it('produces expected natural-language summary text for 30d range', () => {
    const text = buildAnalyticsSummaryText(mockStats, '30d');
    expect(text).toBe(
      'You saved 22 hours, merged 38 PRs, blocked 14 AI submissions, and leveled up 6 contributors this month.',
    );
  });

  it('produces expected summary text for 7d range', () => {
    const text = buildAnalyticsSummaryText(mockStats, '7d');
    expect(text).toBe(
      'You saved 22 hours, merged 38 PRs, blocked 14 AI submissions, and leveled up 6 contributors this week.',
    );
  });

  it('produces expected summary text for 90d range', () => {
    const text = buildAnalyticsSummaryText(mockStats, '90d');
    expect(text).toBe(
      'You saved 22 hours, merged 38 PRs, blocked 14 AI submissions, and leveled up 6 contributors this quarter.',
    );
  });

  it('produces expected summary text for all range', () => {
    const text = buildAnalyticsSummaryText(mockStats, 'all');
    expect(text).toBe(
      'You saved 22 hours, merged 38 PRs, blocked 14 AI submissions, and leveled up 6 contributors overall.',
    );
  });

  it('omits time saved phrase gracefully when maintainerTimeSavedHours is 0', () => {
    const zeroTimeSavedStats: AnalyticsStats = {
      ...mockStats,
      maintainerTimeSavedHours: { value: 0, delta: 0, deltaPositiveIsGood: true },
    };
    const text = buildAnalyticsSummaryText(zeroTimeSavedStats, '30d');
    expect(text).toBe(
      'You merged 38 PRs, blocked 14 AI submissions, and leveled up 6 contributors this month.',
    );
  });

  it('omits time saved phrase when maintainerTimeSavedHours is negative or unavailable', () => {
    const noTimeSavedStats: AnalyticsStats = {
      ...mockStats,
      maintainerTimeSavedHours: { value: -1, delta: 0, deltaPositiveIsGood: true },
    };
    const text = buildAnalyticsSummaryText(noTimeSavedStats, '30d');
    expect(text).toBe(
      'You merged 38 PRs, blocked 14 AI submissions, and leveled up 6 contributors this month.',
    );
  });
});
