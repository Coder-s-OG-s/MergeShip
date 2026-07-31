import {
  cacheRateLimitHitSlidingWindow,
  isSharedCacheAvailable,
  blockedRateLimitBucket,
} from './cache';

export const RATE_LIMIT_TIERS = {
  STANDARD: { limit: 30, windowSec: 60 },
  GENEROUS: { limit: 60, windowSec: 60 },
  MEDIUM: { limit: 20, windowSec: 60 },
  STRICT: { limit: 10, windowSec: 60 },
  HOURLY: { limit: 5, windowSec: 3600 },
} as const;

export type RateLimitOptions = {
  namespace: string;
  key: string;
  limit: number;
  windowSec: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * True on a real production deploy. `next build` sets NODE_ENV=production on
 * Vercel Preview deployments too, so gate on VERCEL_ENV first (only set to
 * 'production' on production deploys) and fall back to NODE_ENV off-Vercel.
 */
function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';
}

/**
 * Sliding-window counter. Every hit in the trailing `windowSec` seconds counts,
 * so a caller can't spend a full budget at the end of one window and another at
 * the start of the next. Backend is swappable without touching callers.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  // `rl:v3:` (was `rl:v2:`) because the sliding-window path stores a Redis
  // sorted-set where the old fixed-window key held an integer; sharing a key
  // across the rollout would raise WRONGTYPE on the first hit.
  const bucketKey = `rl:v3:${opts.namespace}:${opts.key}`;
  const now = Date.now();

  if (isProductionDeploy() && !isSharedCacheAvailable()) {
    console.error(
      '[rate-limit] CRITICAL: No shared cache configured in production — blocking request. Set KV_REST_API_URL/KV_REST_API_TOKEN or REDIS_URL.',
    );
    const blocked = blockedRateLimitBucket(opts.windowSec, now);
    return { ok: false, remaining: 0, resetAt: blocked.resetAt };
  }

  const next = await cacheRateLimitHitSlidingWindow(bucketKey, opts.windowSec, opts.limit, now);

  return {
    ok: next.count <= opts.limit,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: next.resetAt,
  };
}
