/**
 * Single source of truth for XP rules. Every event source declared here.
 * Idempotency keys use the convention: `{prefix}:{repo}:{number}` or similar.
 */

export const XP_REWARDS = {
  RECOMMENDED_MERGE: { E: 50, M: 150, H: 400 },
  UNRECOMMENDED_MERGE: 5,
  ISSUE_OPENED: 2,
  COMMENT: 1,
  REVIEW: 20,
  REVIEW_LANDED: 25, // PR you reviewed gets merged
  HELP_REVIEW_BASE: 30,
  HELP_REVIEW_MENTOR_BONUS: 25, // reviewer.level > mentee.level
  HELP_REVIEW_SPEED_BONUS: 10, // responded <2h
  ISSUE_AUTHORED_CLOSED: 15,
  CONFIRMED_BUG: 10,
  STREAK_PER_DAY: 10,
  STREAK_CAP: 100,
  FIRST_TIME_MULTIPLIER: 2,
  AUDIT_MAX: 1580,
} as const;

export const DAILY_CAPS = {
  ISSUES_OPENED: 3,
  COMMENTS: 30,
  PRS_OPENED: 5,
  REVIEWS: 5,
  SKIPS_PER_REC: 3,
  ENGAGEMENT_XP_PER_REPO: 50,
  TOTAL_XP_TRIPWIRE: 2000,
} as const;

export const XP_SOURCE = {
  GITHUB_AUDIT: 'github_audit',
  RECOMMENDED_MERGE: 'recommended_merge',
  UNRECOMMENDED_MERGE: 'unrecommended_merge',
  ISSUE_OPENED: 'issue_opened',
  COMMENT: 'comment',
  REVIEW: 'review',
  HELP_REVIEW: 'help_review',
  ISSUE_AUTHORED_CLOSED: 'issue_authored_closed',
  STREAK: 'streak',
  FIRST_TIME_BONUS: 'first_time_bonus',
  MAINTAINER_REVOKE: 'maintainer_revoke',
  PENALTY: 'penalty',
} as const;

export type XpSource = (typeof XP_SOURCE)[keyof typeof XP_SOURCE];

// ref_id format helpers — single source of truth.
export const refIds = {
  pr: (repo: string, n: number) => `pr:${repo}:${n}`,
  issue: (repo: string, n: number) => `issue:${repo}:${n}`,
  comment: (repo: string, pr: number, id: number) => `comment:${repo}:${pr}:${id}`,
  review: (repo: string, pr: number, login: string) => `review:${repo}:${pr}:${login}`,
  helpReview: (helpId: number, login: string) => `help-review:${helpId}:${login}`,
  audit: (githubId: string) => `audit:${githubId}`,
  streak: (isoDate: string) => `streak:${isoDate}`,
  firstTime: (kind: string) => `first:${kind}`,
} as const;

export function xpForMerge(difficulty: 'E' | 'M' | 'H'): number {
  return XP_REWARDS.RECOMMENDED_MERGE[difficulty];
}
