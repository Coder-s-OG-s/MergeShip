import { cacheRateLimitHit, blockedRateLimitBucket } from './cache';

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

  // Rate limiting uses the configured cache backend. In production serverless
  // deployments without a shared cache (Upstash/Redis), the MemoryBackend is
  // per-invocation and counters aren't shared — rate limiting degrades to
  // per-request (always passes). A warning is already logged by pickDefaultBackend.
  const next = await cacheRateLimitHit(bucketKey, opts.windowSec, now);

  return {
    ok: next.count <= opts.limit,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: next.resetAt,
  };
}
