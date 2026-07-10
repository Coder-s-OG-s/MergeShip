/**
 * Computes a composite trust score (0 to 100) for a PR author based on their attributes.
 *
 * Weighted formula:
 * - Level: Weight = 40% (max level is 5, so normalized level is level / 5)
 * - XP: Weight = 20% (XP is normalized against a saturation point of 5000 XP)
 * - Merged PRs: Weight = 30% (Merged PR count is normalized against a saturation point of 10 PRs)
 * - Account Age: Weight = 10% (Account age in days is normalized against a saturation point of 90 days)
 *
 * All inputs are normalized to [0, 1] before applying the weights.
 * The final score is rounded to the nearest integer.
 */
export function computeTrustScore(
  level: number,
  xp: number,
  mergedPrs: number,
  accountAgeDays: number,
): number {
  // Normalize inputs to [0, 1] range
  const normLevel = Math.min(Math.max(0, level) / 5, 1);
  const normXp = Math.min(Math.max(0, xp) / 5000, 1);
  const normMergedPrs = Math.min(Math.max(0, mergedPrs) / 10, 1);
  const normAccountAge = Math.min(Math.max(0, accountAgeDays) / 90, 1);

  // Apply weights
  const score = normLevel * 40 + normXp * 20 + normMergedPrs * 30 + normAccountAge * 10;

  return Math.round(score);
}
