import { cacheIncr } from './cache';

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
  const now = Date.now();
  const ttlMs = opts.windowSec * 1000;
  const windowStart = Math.floor(now / ttlMs) * ttlMs;
  const resetAt = windowStart + ttlMs;
  const bucketKey = `rl:${opts.namespace}:${opts.key}:${windowStart}`;
  const remainingTtl = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const count = await cacheIncr(bucketKey, remainingTtl);

  if (count > opts.limit) {
    return { ok: false, remaining: 0, resetAt };
  }

  return {
    ok: true,
    remaining: Math.max(0, opts.limit - count),
    resetAt,
  };
}
