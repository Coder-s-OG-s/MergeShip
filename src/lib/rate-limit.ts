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
 *
 * In production serverless environments, rate limiting depends on a shared
 * cache backend (Upstash Redis or ioredis). When no distributed backend is
 * configured, each serverless invocation has its own isolated counter and
 * rate limiting is effectively disabled. This function enforces that
 * requirement: in production, if no shared cache is available, every request
 * is blocked until an operator configures KV_REST_API_URL or REDIS_URL.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();

  if (process.env.NODE_ENV === 'production' && !isSharedCacheAvailable()) {
    console.error(
      `[rate-limit] FATAL: No shared cache backend configured in production. ` +
        `Rate limiting is disabled. Set KV_REST_API_URL + KV_REST_API_TOKEN or REDIS_URL. ` +
        `Blocking all requests to namespace "${opts.namespace}".`,
    );
    const blocked = blockedRateLimitBucket(opts.windowSec, now);
    return { ok: false, remaining: 0, resetAt: blocked.resetAt };
  }

  const bucketKey = `rl:v2:${opts.namespace}:${opts.key}`;
  const next = await cacheRateLimitHit(bucketKey, opts.windowSec, now);

  return {
    ok: next.count <= opts.limit,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: next.resetAt,
  };
}
