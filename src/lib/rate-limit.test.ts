import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { __setMemoryCache } from './cache';
import { rateLimit, RATE_LIMIT_TIERS } from './rate-limit';

beforeEach(() => {
  __setMemoryCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-12T00:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('rateLimit', () => {
  it('first hit allowed, remaining decreases', async () => {
    const r = await rateLimit({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('subsequent hits decrement remaining', async () => {
    const opts = { namespace: 'test', key: 'u1', limit: 3, windowSec: 60 };
    expect((await rateLimit(opts)).remaining).toBe(2);
    expect((await rateLimit(opts)).remaining).toBe(1);
    expect((await rateLimit(opts)).remaining).toBe(0);
    expect((await rateLimit(opts)).ok).toBe(false);
  });

  it('blocked when over limit', async () => {
    const opts = { namespace: 'test', key: 'u1', limit: 2, windowSec: 60 };
    await rateLimit(opts);
    await rateLimit(opts);
    const blocked = await rateLimit(opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('does not allow concurrent bursts past the limit', async () => {
    const opts = { namespace: 'test', key: 'burst', limit: 5, windowSec: 60 };
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(opts)));
    const firstResetAt = results.at(0)?.resetAt;

    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(15);
    expect(firstResetAt).toBeDefined();
    expect(results.every((r) => r.resetAt === firstResetAt)).toBe(true);
  });

  it('separate keys do not share budget', async () => {
    const a = await rateLimit({ namespace: 'test', key: 'a', limit: 1, windowSec: 60 });
    const b = await rateLimit({ namespace: 'test', key: 'b', limit: 1, windowSec: 60 });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it('separate namespaces do not share budget', async () => {
    const x = await rateLimit({ namespace: 'x', key: 'u', limit: 1, windowSec: 60 });
    const y = await rateLimit({ namespace: 'y', key: 'u', limit: 1, windowSec: 60 });
    expect(x.ok).toBe(true);
    expect(y.ok).toBe(true);
  });

  it('reset timestamp in the future', async () => {
    const r = await rateLimit({ namespace: 'test', key: 'u', limit: 5, windowSec: 60 });
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });
});

describe('rateLimit production guard', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllEnvs();
  });

  it('blocks requests when NODE_ENV=production and no shared cache configured (fail-closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.REDIS_URL;

    const { rateLimit: rl } = await import('./rate-limit');

    const result = await rl({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    // In production without a shared cache, requests are blocked to prevent
    // silent rate-limit bypass.
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('blocks requests on a Vercel production deploy without a shared cache', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.REDIS_URL;

    const { rateLimit: rl } = await import('./rate-limit');

    const result = await rl({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('does not block on a Vercel preview deploy even when NODE_ENV=production', async () => {
    // `next build` sets NODE_ENV=production on previews too; only real
    // production deploys should fail closed without a shared cache.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'preview');
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.REDIS_URL;

    const { rateLimit: rl } = await import('./rate-limit');

    const result = await rl({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows requests when NODE_ENV is not production even without shared cache', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.VERCEL_ENV;

    const { rateLimit: rl } = await import('./rate-limit');

    const result = await rl({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe('rateLimit sliding window', () => {
  it('evicts hits older than the window so budget recovers', async () => {
    const opts = { namespace: 'sw', key: 'eviction', limit: 3, windowSec: 60 };
    for (let i = 0; i < 3; i++) await rateLimit(opts);
    expect((await rateLimit(opts)).ok).toBe(false);

    // Advance past the window so every prior hit ages out.
    vi.advanceTimersByTime(60_001);
    const after = await rateLimit(opts);
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(2);
  });

  it('blocks a burst that straddles the fixed-window boundary', async () => {
    // The loophole a sliding window closes: spend the whole budget near the end
    // of one window, then immediately again at the start of the next.
    const opts = { namespace: 'sw', key: 'straddle', limit: 4, windowSec: 60 };
    for (let i = 0; i < 4; i++) await rateLimit(opts);

    // Half a window later the earliest hits are still in range, so further hits
    // stay blocked — a fixed window would have reset and allowed 4 more.
    vi.advanceTimersByTime(30_000);
    expect((await rateLimit(opts)).ok).toBe(false);
  });

  it('keeps blocking while older-but-in-window hits remain', async () => {
    const opts = { namespace: 'sw', key: 'partial', limit: 2, windowSec: 60 };
    await rateLimit(opts); // t=0
    vi.advanceTimersByTime(40_000);
    await rateLimit(opts); // t=40s
    expect((await rateLimit(opts)).ok).toBe(false); // t=40s, over limit

    // At t=61s the t=0 hit ages out, but the t=40s hits are still inside the
    // trailing 60s, so the caller stays blocked.
    vi.advanceTimersByTime(21_000);
    expect((await rateLimit(opts)).ok).toBe(false);
  });

  it('resetAt is the trailing window measured from the latest hit', async () => {
    const r = await rateLimit({ namespace: 'sw', key: 'reset', limit: 5, windowSec: 60 });
    expect(r.resetAt).toBe(Date.now() + 60_000);
  });
});

describe('RATE_LIMIT_TIERS', () => {
  it('defines standard, generous, medium, strict, and hourly tiers', () => {
    expect(RATE_LIMIT_TIERS.STANDARD).toEqual({ limit: 30, windowSec: 60 });
    expect(RATE_LIMIT_TIERS.GENEROUS).toEqual({ limit: 60, windowSec: 60 });
    expect(RATE_LIMIT_TIERS.MEDIUM).toEqual({ limit: 20, windowSec: 60 });
    expect(RATE_LIMIT_TIERS.STRICT).toEqual({ limit: 10, windowSec: 60 });
    expect(RATE_LIMIT_TIERS.HOURLY).toEqual({ limit: 5, windowSec: 3600 });
  });
});
