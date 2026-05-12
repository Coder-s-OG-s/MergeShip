import { XP_REWARDS } from './sources';

/**
 * Onboarding audit signals from a user's public GitHub history.
 * Runs once at signup. The dominant signal is non_own_merged_prs — that's the
 * only one that proves the person ships code into someone else's project.
 */
export type AuditSignals = {
  accountAgeYears: number;
  mergedPrs: number;
  nonOwnMergedPrs: number;
  closedIssues: number;
  distinctLanguages: number;
  yearlyContributions: number;
  followers: number;
};

function nonNeg(x: number, cap: number): number {
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(x, cap);
}

export function computeAuditScore(s: AuditSignals): number {
  const score =
    nonNeg(s.accountAgeYears, 5) * 20 +
    nonNeg(s.mergedPrs, 50) * 8 +
    nonNeg(s.nonOwnMergedPrs, 30) * 15 +
    nonNeg(s.closedIssues, 30) * 5 +
    nonNeg(s.distinctLanguages, 8) * 10 +
    nonNeg(s.yearlyContributions, 1000) * 0.3 +
    nonNeg(s.followers, 200) * 0.5;

  return Math.min(Math.round(score), XP_REWARDS.AUDIT_MAX);
}
