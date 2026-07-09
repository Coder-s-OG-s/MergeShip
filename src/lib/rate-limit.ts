import { cacheRateLimitHit, isSharedCacheAvailable, blockedRateLimitBucket } from './cache';

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
 * Fixed-window counter. Cheap, predictable, good enough for our scale.
 * If we ever need true sliding window precision, swap the backend without touching callers.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const bucketKey = `rl:v2:${opts.namespace}:${opts.key}`;
  const now = Date.now();

  if (process.env.NODE_ENV === 'production' && !isSharedCacheAvailable()) {
    console.error(
      '[rate-limit] no shared cache configured in production — blocking request. Set KV_REST_API_URL/KV_REST_API_TOKEN or REDIS_URL.',
    );
    const blocked = blockedRateLimitBucket(opts.windowSec, now);
    return { ok: false, remaining: 0, resetAt: blocked.resetAt };
  }

  const next = await cacheRateLimitHit(bucketKey, opts.windowSec, now);

  return {
    ok: next.count <= opts.limit,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: next.resetAt,
  };
}
