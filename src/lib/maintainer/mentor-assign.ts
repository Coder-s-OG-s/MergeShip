export type SeniorMaintainer = {
  userId: string;
  handle: string;
  activeReviewCount: number;
};

// A mentor can only be routed a PR if they're actually allowed to verify it.
// verifyPrAction (app/actions/mentor.ts) gates verification on profiles.level >= 2,
// so auto-assignment must draw from the same L2+ pool.
export const MENTOR_MIN_LEVEL = 2;

export function shouldAutoAssignMentor(
  authorLevel: number | null,
  minContributorLevel: number,
): boolean {
  if (authorLevel === null) return false;
  return authorLevel < minContributorLevel;
}

export function pickMentor(
  seniors: SeniorMaintainer[],
  excludedUserId?: string | null,
): SeniorMaintainer | null {
  const candidates = seniors
    .filter((senior) => senior.userId !== excludedUserId)
    .sort(
      (a, b) =>
        a.activeReviewCount - b.activeReviewCount ||
        a.handle.localeCompare(b.handle) ||
        a.userId.localeCompare(b.userId),
    );

  return candidates[0] ?? null;
}
