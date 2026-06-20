export type ActivityDay = {
  date: string;
  count: number;
};

export type ContributionDay = {
  date: string;
  contributionCount: number;
};

/** Merge contribution counts by UTC date (YYYY-MM-DD). */
export function mergeActivityDays(
  sources: readonly { date: string; count: number }[],
): ActivityDay[] {
  const countMap = new Map<string, number>();
  for (const { date, count } of sources) {
    if (!date || count <= 0) continue;
    countMap.set(date, (countMap.get(date) ?? 0) + count);
  }
  return Array.from(countMap.entries()).map(([date, count]) => ({ date, count }));
}

export function contributionCalendarToActivity(days: readonly ContributionDay[]): ActivityDay[] {
  return mergeActivityDays(
    days.map(({ date, contributionCount }) => ({ date, count: contributionCount })),
  );
}

export function totalContributions(days: readonly ActivityDay[]): number {
  return days.reduce((sum, d) => sum + d.count, 0);
}

export function bumpActivityDay(
  countMap: Map<string, number>,
  iso: string | null | undefined,
  amount = 1,
): void {
  if (!iso || amount <= 0) return;
  const date = iso.slice(0, 10);
  countMap.set(date, (countMap.get(date) ?? 0) + amount);
}
