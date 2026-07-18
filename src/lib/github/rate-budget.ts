import { cacheGet, cacheSet } from '../cache';

const _parsedThreshold = parseInt(process.env.GITHUB_API_BUDGET_THRESHOLD || '', 10);
export const GITHUB_API_BUDGET_THRESHOLD =
  Number.isFinite(_parsedThreshold) && _parsedThreshold >= 0 ? _parsedThreshold : 500;

export type RateBudget = {
  remaining: number;
  resetAt: number; // raw GitHub timestamp (seconds since epoch)
};

function getBudgetCacheKey(installationId: number) {
  return `gh:budget:install:${installationId}`;
}

/**
 * Updates the rate limit budget for a GitHub App installation.
 * @param installationId The GitHub App installation ID
 * @param remaining Remaining API requests for the primary limit
 * @param resetAt The reset timestamp in seconds since epoch
 */
export async function updateRateBudget(
  installationId: number,
  remaining: number,
  resetAt: number,
): Promise<void> {
  if (!Number.isFinite(remaining) || !Number.isFinite(resetAt) || remaining < 0 || resetAt <= 0) {
    return;
  }
  try {
    const ttlSeconds = Math.max(0, resetAt - Math.floor(Date.now() / 1000));
    await cacheSet(getBudgetCacheKey(installationId), { remaining, resetAt }, ttlSeconds);
  } catch {
    // Fail open: if cache fails, do not crash the calling process
  }
}

/**
 * Checks the current rate limit budget for a given installation.
 * Explicitly models the unknown state (returning ok: true) if no budget is cached,
 * so that subsequent API requests can populate the budget via headers.
 *
 * @param installationId The GitHub App installation ID
 * @returns { ok: boolean, resetAt: number, remaining: number | null }
 */
export async function checkRateBudget(
  installationId: number,
): Promise<{ ok: boolean; resetAt: number; remaining: number | null }> {
  try {
    const budget = await cacheGet<RateBudget>(getBudgetCacheKey(installationId));

    if (!budget) {
      // Unknown budget state: allow requests to populate the budget
      return { ok: true, resetAt: 0, remaining: null };
    }

    if (budget.remaining < GITHUB_API_BUDGET_THRESHOLD) {
      return { ok: false, resetAt: budget.resetAt, remaining: budget.remaining };
    }

    return { ok: true, resetAt: budget.resetAt, remaining: budget.remaining };
  } catch {
    // Fail open if cache is unreachable
    return { ok: true, resetAt: 0, remaining: null };
  }
}
