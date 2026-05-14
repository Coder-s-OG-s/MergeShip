/**
 * Compute the user's current consecutive-day streak from their xp_events
 * timestamps. Pure helper; caller supplies the rows and "today" as YYYY-MM-DD
 * so tests can pin to a known date.
 *
 * Definition: the longest run of consecutive UTC days ending at either today
 * or yesterday for which the user has at least one xp_event. Multiple events
 * on the same day count as one. Future-dated events are ignored.
 */
export function computeCurrentStreak(
  events: ReadonlyArray<{ created_at: string }>,
  todayYmd: string,
): number {
  const todayMs = Date.UTC(
    parseInt(todayYmd.slice(0, 4), 10),
    parseInt(todayYmd.slice(5, 7), 10) - 1,
    parseInt(todayYmd.slice(8, 10), 10),
  );

  // Collect distinct UTC day strings ≤ today.
  const days = new Set<string>();
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (t > todayMs + 24 * 3600 * 1000 - 1) continue; // future-dated: skip
    days.add(new Date(t).toISOString().slice(0, 10));
  }
  if (days.size === 0) return 0;

  // Start from today; if no event today, allow yesterday as the head.
  let anchor: Date;
  const todayStr = new Date(todayMs).toISOString().slice(0, 10);
  if (days.has(todayStr)) {
    anchor = new Date(todayMs);
  } else {
    const y = new Date(todayMs - 24 * 3600 * 1000);
    if (!days.has(y.toISOString().slice(0, 10))) return 0;
    anchor = y;
  }

  let streak = 0;
  let cursor = anchor;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
  }
  return streak;
}
