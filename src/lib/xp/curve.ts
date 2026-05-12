/**
 * Leveling curve. xp_for_level(L) = floor(100 * L^2.2).
 * Thresholds are pre-computed so we don't pay Math.pow on every request.
 * Postgres mirrors these in level_for_xp() — keep in sync.
 */

export const MAX_LEVEL = 5;

const THRESHOLDS: readonly number[] = [
  0, // L0
  100, // L1
  459, // L2
  1119, // L3
  2089, // L4
  3404, // L5
];

export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) {
    throw new Error(`xpForLevel: level must be a non-negative integer, got ${level}`);
  }
  if (level >= THRESHOLDS.length) return THRESHOLDS[THRESHOLDS.length - 1]!;
  return THRESHOLDS[level]!;
}

export function levelForXp(xp: number): number {
  const x = Math.max(0, Math.floor(xp));
  let level = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (x >= THRESHOLDS[i]!) {
      level = i;
      break;
    }
  }
  return level;
}

export function xpToNextLevel(xp: number): { next: number | null; needed: number } {
  const current = levelForXp(xp);
  if (current >= MAX_LEVEL) return { next: null, needed: 0 };
  const nextThreshold = THRESHOLDS[current + 1]!;
  return { next: current + 1, needed: nextThreshold - Math.max(0, xp) };
}
