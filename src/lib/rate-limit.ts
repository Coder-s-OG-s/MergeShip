import { cacheGet, cacheSet } from './cache';

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
  const bucketKey = `rl:${opts.namespace}:${opts.key}`;
  const now = Date.now();
  const ttlMs = opts.windowSec * 1000;

  const existing = await cacheGet<{ count: number; resetAt: number }>(bucketKey);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + ttlMs };
    await cacheSet(bucketKey, fresh, opts.windowSec);
    return { ok: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  const next = { count: existing.count + 1, resetAt: existing.resetAt };
  const remainingTtl = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  await cacheSet(bucketKey, next, remainingTtl);

  return {
    ok: true,
    remaining: Math.max(0, opts.limit - next.count),
    resetAt: existing.resetAt,
  };
}
