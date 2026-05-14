/**
 * Pick the most-used language from a user's public repo list.
 * Used at audit time to populate profiles.primary_language so the
 * recommendation pipeline can prefer language-matching issues.
 */
export function pickPrimaryLanguage(
  langs: ReadonlyArray<string | null | undefined>,
): string | null {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const raw of langs) {
    if (!raw || typeof raw !== 'string') continue;
    if (!counts.has(raw)) order.push(raw);
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  if (order.length === 0) return null;

  let best = order[0]!;
  let bestCount = counts.get(best) ?? 0;
  for (const lang of order) {
    const c = counts.get(lang) ?? 0;
    if (c > bestCount) {
      best = lang;
      bestCount = c;
    }
  }
  return best;
}
