import { cacheGet, cacheSet, isSharedCacheAvailable } from './cache';

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
 * NOTE: When no Redis backend is configured (isSharedCacheAvailable === false),
 * the underlying MemoryBackend is process-local. In a serverless deployment each
 * Lambda invocation has its own process, so counters reset on every cold-start and
 * are never shared across concurrent requests. Rate limits are effectively disabled.
 * Set KV_REST_API_URL/KV_REST_API_TOKEN or REDIS_URL to restore enforcement.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (!isSharedCacheAvailable && process.env.NODE_ENV === 'production') {
    // Allow the request through but emit a warning so the operator knows limits
    // are not being enforced. Returning ok:true avoids blocking all traffic when
    // the only issue is a missing environment variable.
    console.warn(
      `[rate-limit] WARNING: rate limit check skipped for ${opts.namespace}:${opts.key} ` +
        'because no shared cache backend is configured. All requests are being allowed through.',
    );
    return { ok: true, remaining: opts.limit, resetAt: Date.now() + opts.windowSec * 1000 };
  }
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
