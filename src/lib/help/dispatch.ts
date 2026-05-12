/**
 * Help dispatch ranking. Pure function — the async DB fetch lives in the
 * Inngest function that calls this.
 *
 * Three rings (high to low priority):
 *  1. L2+ users who've reviewed in this same GitHub org before
 *  2. L2+ cohort-mates whose primary_language matches the PR's language
 *  3. Any L2+ in the broader cohort
 *
 * Reviewer must be at least one level above the mentee. Ring 1 has the
 * heaviest weight; language-match within ring 2 is a tiebreaker.
 */

export type ReviewerCandidate = {
  userId: string;
  level: number;
  sameOrgReviewed: boolean;
  sameCohort: boolean;
  languageMatch: boolean;
};

export type DispatchOptions = {
  menteeLevel: number;
  maxNotify?: number;
};

const DEFAULT_MAX_NOTIFY = 12;
const MIN_REVIEWER_LEVEL = 2;

function ringScore(c: ReviewerCandidate): number {
  let score = 0;
  if (c.sameOrgReviewed) score += 100;
  if (c.sameCohort && c.languageMatch) score += 50;
  if (c.sameCohort) score += 25;
  score += c.level * 5;
  return score;
}

export function rankReviewers(
  candidates: readonly ReviewerCandidate[],
  opts: DispatchOptions,
): ReviewerCandidate[] {
  const minLevel = Math.max(MIN_REVIEWER_LEVEL, opts.menteeLevel + 1);
  const max = opts.maxNotify ?? DEFAULT_MAX_NOTIFY;
  return [...candidates]
    .filter((c) => c.level >= minLevel)
    .sort((a, b) => ringScore(b) - ringScore(a))
    .slice(0, max);
}
