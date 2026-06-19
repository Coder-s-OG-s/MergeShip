export type SeniorMaintainer = {
  userId: string;
  handle: string;
};

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
    .sort((a, b) => a.handle.localeCompare(b.handle) || a.userId.localeCompare(b.userId));

  return candidates[0] ?? null;
}
