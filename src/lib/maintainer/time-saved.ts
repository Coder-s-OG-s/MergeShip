export const AI_REVIEW_MINUTES = 45;
export const CHAIN_REVIEW_MINUTES = 30;
export const TRIAGE_MINUTES = 10;

export type TimeSavedBreakdown = {
  aiFilteringHours: number;
  chainReviewsHours: number;
  autoTriageHours: number;
  totalHours: number;
  projectedAnnualHours: number;
};

export type { AnalyticsRange } from './analytics-range';

export function computeTimeSaved(params: {
  aiBlockedPrs: number;
  mentorVerifiedPrs: number;
  autoTriagedIssues: number;
  daysInRange: number;
}): TimeSavedBreakdown {
  const aiFilteringHours = (params.aiBlockedPrs * AI_REVIEW_MINUTES) / 60;
  const chainReviewsHours = (params.mentorVerifiedPrs * CHAIN_REVIEW_MINUTES) / 60;
  const autoTriageHours = (params.autoTriagedIssues * TRIAGE_MINUTES) / 60;
  const totalHours = aiFilteringHours + chainReviewsHours + autoTriageHours;

  let projectedAnnualHours = 0;
  if (params.daysInRange > 0) {
    projectedAnnualHours = Math.round((totalHours / params.daysInRange) * 365);
  }

  return {
    aiFilteringHours,
    chainReviewsHours,
    autoTriageHours,
    totalHours,
    projectedAnnualHours,
  };
}
