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

  if (process.env.NODE_ENV === 'production' && !isSharedCacheAvailable()) {
    console.warn(
      '[rate-limit] no shared cache configured in production — falling back to memory-based rate limiting. Set KV_REST_API_URL/KV_REST_API_TOKEN or REDIS_URL.',
    );
  }

  const next = await cacheRateLimitHitSlidingWindow(bucketKey, opts.windowSec, opts.limit, now);

  return {
    ok: next.count <= opts.limit,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: next.resetAt,
  };
}
