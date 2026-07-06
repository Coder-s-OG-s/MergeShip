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

  it('blocks all requests when NODE_ENV=production and no shared cache configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.REDIS_URL;

    const { rateLimit: rl } = await import('./rate-limit');

    const result = await rl({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows requests when NODE_ENV is not production even without shared cache', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { rateLimit: rl } = await import('./rate-limit');

    const result = await rl({ namespace: 'test', key: 'u1', limit: 5, windowSec: 60 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
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
