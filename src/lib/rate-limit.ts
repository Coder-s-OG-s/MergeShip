import { cacheRateLimitHit } from './cache';

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
  const next = await cacheRateLimitHit(bucketKey, opts.windowSec, now);

  return {
    ok: next.count <= opts.limit,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: next.resetAt,
  };
}
