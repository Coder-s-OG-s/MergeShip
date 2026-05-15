import { xpForLevel } from './curve';

/**
 * Anti-cheat clamp for the onboarding audit.
 *
 * The doc says experienced contributors should land at most at L2 from
 * audit-only signals — that's the "safe maximum for auto-placement".
 * Pushing above L2 requires actually solving recommended issues on
 * MergeShip after signup, which can't be gamed by faking GitHub history.
 *
 * Today the audit formula caps the raw score at 1580 XP, which by chance
 * lands just under L3 (2089 XP). This function makes the safety rule
 * explicit so a future tweak to either formula doesn't silently break it.
 */
export function clampAuditScoreToLevel(rawScore: number, maxLevel: number): number {
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0;
  const ceiling = xpForLevel(maxLevel + 1) - 1;
  return Math.min(Math.floor(rawScore), ceiling);
}
