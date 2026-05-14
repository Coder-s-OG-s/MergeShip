export function parsePRState(
  apiState: string,
  mergedAt: string | null,
): 'open' | 'closed' | 'merged' {
  if (mergedAt != null) return 'merged';
  if (apiState === 'open') return 'open';
  return 'closed';
}

export function calculateStreak(
  days: { date: string; contributionCount: number }[],
  today: string,
): number {
  const sorted = [...days]
    .filter((d) => d.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  let expectingDate: string | null = null;

  for (const day of sorted) {
    if (expectingDate === null) {
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        expectingDate = prevDay(day.date);
        continue;
      }
    } else {
      if (day.date !== expectingDate) break;
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        break;
      }
    }
  }

  return streak;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
