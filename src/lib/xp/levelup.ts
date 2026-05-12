import { levelForXp } from './curve';

/**
 * Pure helper. The Postgres trigger already inserts level_ups rows on the DB
 * side; this function is for code paths that compute level transitions in
 * memory (e.g. previewing what a pending event would do).
 */
export function detectLevelUp(input: {
  xpBefore: number;
  xpAfter: number;
}): { leveledUp: false } | { leveledUp: true; from: number; to: number } {
  const from = levelForXp(input.xpBefore);
  const to = levelForXp(input.xpAfter);
  if (to > from) return { leveledUp: true, from, to };
  return { leveledUp: false };
}
