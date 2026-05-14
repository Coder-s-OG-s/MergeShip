import { DAILY_CAPS } from './sources';

/**
 * Daily XP sanity tripwire. If a user's daily XP total crosses 2000 it
 * doesn't block anything — real work (merge-driven XP) is unbounded — but
 * we write a row to activity_log so a future moderation surface can
 * surface unusual patterns (coordinated farming rings, etc).
 *
 * `priorTotal` is the user's xp_events sum for today BEFORE the new
 * event. `delta` is the new event's xp_delta. Returns true exactly once
 * per day, on the event that crosses the threshold — so we don't write
 * a tripwire row for every subsequent event the same day.
 */
export const TRIPWIRE_THRESHOLD = DAILY_CAPS.TOTAL_XP_TRIPWIRE;

export function shouldFireTripwire(priorTotal: number, delta: number): boolean {
  if (delta <= 0) return false;
  if (priorTotal >= TRIPWIRE_THRESHOLD) return false;
  return priorTotal + delta >= TRIPWIRE_THRESHOLD;
}
