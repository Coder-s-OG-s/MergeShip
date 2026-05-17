import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { __setMemoryCache } from './cache';
import { rateLimit } from './rate-limit';

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

  it('enforces the limit for concurrent requests to the same bucket', async () => {
    const opts = { namespace: 'test', key: 'burst', limit: 5, windowSec: 60 };
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(opts)));

    expect(results.filter((result) => result.ok)).toHaveLength(5);
    expect(results.filter((result) => !result.ok)).toHaveLength(15);
    expect(results.every((result) => result.resetAt === results[0]?.resetAt)).toBe(true);
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
