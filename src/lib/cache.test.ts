import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __setMemoryCache,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelByPrefix,
  cacheRateLimitHitSlidingWindow,
  IoRedisBackend,
  UpstashBackend,
} from './cache';

beforeEach(() => {
  __setMemoryCache();
  vi.clearAllMocks();
});

describe('cache (memory backend)', () => {
  it('get returns null on miss', async () => {
    expect(await cacheGet('nope')).toBeNull();
  });

  it('set then get round-trip', async () => {
    await cacheSet('k', { a: 1 }, 60);
    expect(await cacheGet('k')).toEqual({ a: 1 });
  });

  it('respects TTL', async () => {
    await cacheSet('exp', 'v', -1); // already expired
    expect(await cacheGet('exp')).toBeNull();
  });

  it('del removes entry', async () => {
    await cacheSet('x', 1, 60);
    await cacheDel('x');
    expect(await cacheGet('x')).toBeNull();
  });

  it('delByPrefix removes matching keys', async () => {
    await cacheSet('recs:alice', 'a', 60);
    await cacheSet('recs:bob', 'b', 60);
    await cacheSet('other:keep', 'k', 60);
    await cacheDelByPrefix('recs:');
    expect(await cacheGet('recs:alice')).toBeNull();
    expect(await cacheGet('recs:bob')).toBeNull();
    expect(await cacheGet('other:keep')).toBe('k');
  });

  it('overwrites existing key', async () => {
    await cacheSet('k', 'first', 60);
    await cacheSet('k', 'second', 60);
    expect(await cacheGet('k')).toBe('second');
  });
});

describe('cacheRateLimitHitSlidingWindow (memory backend)', () => {
  it('counts every hit inside the trailing window', async () => {
    const now = 1_000_000;
    const a = await cacheRateLimitHitSlidingWindow('rl:sw', 60, 5, now);
    expect(a.count).toBe(1);
    const b = await cacheRateLimitHitSlidingWindow('rl:sw', 60, 5, now + 1000);
    expect(b.count).toBe(2);
    expect(b.resetAt).toBe(now + 1000 + 60_000);
  });

  it('evicts hits older than the window', async () => {
    const now = 1_000_000;
    await cacheRateLimitHitSlidingWindow('rl:sw', 60, 5, now);
    await cacheRateLimitHitSlidingWindow('rl:sw', 60, 5, now + 10_000);
    // 61s after the first hit: the first ages out, the second is still in range.
    const c = await cacheRateLimitHitSlidingWindow('rl:sw', 60, 5, now + 61_000);
    expect(c.count).toBe(2);
  });

  it('caps stored timestamps at limit + 1 without changing the block decision', async () => {
    const now = 1_000_000;
    let last: { count: number; resetAt: number } | undefined;
    for (let i = 0; i < 10; i++) {
      last = await cacheRateLimitHitSlidingWindow('rl:cap', 60, 3, now + i);
    }
    expect(last?.count).toBe(4);
  });
});

describe('IoRedisBackend', () => {
  it('get deserializes valid JSON', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(JSON.stringify({ x: 1 })) };
    const backend = new IoRedisBackend(mockRedis as any);
    expect(await backend.get('key')).toEqual({ x: 1 });
    expect(mockRedis.get).toHaveBeenCalledWith('key');
  });

  it('get returns null on miss', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(null) };
    const backend = new IoRedisBackend(mockRedis as any);
    expect(await backend.get('key')).toBeNull();
  });

  it('get returns null on invalid JSON or connection failure', async () => {
    const mockRedis = { get: vi.fn().mockRejectedValue(new Error('Connection error')) };
    const backend = new IoRedisBackend(mockRedis as any);
    expect(await backend.get('key')).toBeNull();
  });

  it('set serializes value and applies TTL', async () => {
    const mockRedis = { set: vi.fn().mockResolvedValue('OK') };
    const backend = new IoRedisBackend(mockRedis as any);
    await backend.set('key', { y: 2 }, 60);
    expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify({ y: 2 }), 'EX', 60);
  });

  it('set ignores TTL <= 0', async () => {
    const mockRedis = { set: vi.fn() };
    const backend = new IoRedisBackend(mockRedis as any);
    await backend.set('key', 'val', 0);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('set swallows connection errors gracefully', async () => {
    const mockRedis = { set: vi.fn().mockRejectedValue(new Error('Write error')) };
    const backend = new IoRedisBackend(mockRedis as any);
    await expect(backend.set('key', 'val', 60)).resolves.not.toThrow();
  });

  it('del removes key and swallows errors', async () => {
    const mockRedis = { del: vi.fn().mockResolvedValue(1) };
    const backend = new IoRedisBackend(mockRedis as any);
    await backend.del('key');
    expect(mockRedis.del).toHaveBeenCalledWith('key');
  });

  it('scanDel scans and deletes matching keys', async () => {
    const mockRedis = {
      scan: vi
        .fn()
        .mockResolvedValueOnce(['next-cursor', ['k1', 'k2']])
        .mockResolvedValueOnce(['0', ['k3']]),
      del: vi.fn().mockResolvedValue(1),
    };
    const backend = new IoRedisBackend(mockRedis as any);
    await backend.scanDel('prefix:');
    expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    expect(mockRedis.del).toHaveBeenCalledWith('k1', 'k2');
    expect(mockRedis.del).toHaveBeenCalledWith('k3');
  });

  it('rateLimitHit returns blocked bucket on redis error (fail-closed)', async () => {
    const mockRedis = { incr: vi.fn().mockRejectedValue(new Error('Redis down')) };
    const backend = new IoRedisBackend(mockRedis as any);
    const result = await backend.rateLimitHit('rl:key', 60, 1000);
    expect(result.count).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.resetAt).toBe(1000 + 60 * 1000);
  });

  it('rateLimitHitSlidingWindow reads the zcard from the atomic pipeline', async () => {
    const mockRedis = {
      multi: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 3],
        [null, 1],
      ]),
    };
    const backend = new IoRedisBackend(mockRedis as any);
    const result = await backend.rateLimitHitSlidingWindow('rl:key', 60, 10, 1000);
    expect(result.count).toBe(3);
    expect(result.resetAt).toBe(1000 + 60 * 1000);
    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith('rl:key', 0, 1000 - 60_000);
  });

  it('rateLimitHitSlidingWindow fails closed on redis error', async () => {
    const mockRedis = {
      multi: vi.fn(() => {
        throw new Error('Redis down');
      }),
    };
    const backend = new IoRedisBackend(mockRedis as any);
    const result = await backend.rateLimitHitSlidingWindow('rl:key', 60, 10, 1000);
    expect(result.count).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.resetAt).toBe(1000 + 60 * 1000);
  });
});

describe('UpstashBackend', () => {
  it('get returns deserialized value directly from client', async () => {
    const mockUpstash = { get: vi.fn().mockResolvedValue({ x: 1 }) };
    const backend = new UpstashBackend(mockUpstash as any);
    expect(await backend.get('key')).toEqual({ x: 1 });
    expect(mockUpstash.get).toHaveBeenCalledWith('key');
  });

  it('get returns null on connection/fetch error', async () => {
    const mockUpstash = { get: vi.fn().mockRejectedValue(new Error('Fetch failed')) };
    const backend = new UpstashBackend(mockUpstash as any);
    expect(await backend.get('key')).toBeNull();
  });

  it('set serializes value and sets ex option', async () => {
    const mockUpstash = { set: vi.fn().mockResolvedValue('OK') };
    const backend = new UpstashBackend(mockUpstash as any);
    await backend.set('key', { y: 2 }, 60);
    expect(mockUpstash.set).toHaveBeenCalledWith('key', { y: 2 }, { ex: 60 });
  });

  it('set ignores TTL <= 0', async () => {
    const mockUpstash = { set: vi.fn() };
    const backend = new UpstashBackend(mockUpstash as any);
    await backend.set('key', 'val', 0);
    expect(mockUpstash.set).not.toHaveBeenCalled();
  });

  it('set swallows exceptions', async () => {
    const mockUpstash = { set: vi.fn().mockRejectedValue(new Error('Fetch failed')) };
    const backend = new UpstashBackend(mockUpstash as any);
    await expect(backend.set('key', 'val', 60)).resolves.not.toThrow();
  });

  it('del removes key and swallows errors', async () => {
    const mockUpstash = { del: vi.fn().mockResolvedValue(1) };
    const backend = new UpstashBackend(mockUpstash as any);
    await backend.del('key');
    expect(mockUpstash.del).toHaveBeenCalledWith('key');
  });

  it('scanDel recursively deletes all prefix matched keys', async () => {
    const mockUpstash = {
      scan: vi
        .fn()
        .mockResolvedValueOnce([1, ['k1', 'k2']])
        .mockResolvedValueOnce(['0', ['k3']]),
      del: vi.fn().mockResolvedValue(1),
    };
    const backend = new UpstashBackend(mockUpstash as any);
    await backend.scanDel('prefix:');
    expect(mockUpstash.scan).toHaveBeenCalledTimes(2);
    expect(mockUpstash.del).toHaveBeenCalledWith('k1', 'k2');
    expect(mockUpstash.del).toHaveBeenCalledWith('k3');
  });

  it('rateLimitHit returns blocked bucket on redis error (fail-closed)', async () => {
    const mockUpstash = { incr: vi.fn().mockRejectedValue(new Error('Redis down')) };
    const backend = new UpstashBackend(mockUpstash as any);
    const result = await backend.rateLimitHit('rl:key', 60, 1000);
    expect(result.count).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.resetAt).toBe(1000 + 60 * 1000);
  });

  it('rateLimitHitSlidingWindow reads the zcard from the atomic pipeline', async () => {
    const mockUpstash = {
      multi: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 4, 1]),
    };
    const backend = new UpstashBackend(mockUpstash as any);
    const result = await backend.rateLimitHitSlidingWindow('rl:key', 60, 10, 2000);
    expect(result.count).toBe(4);
    expect(result.resetAt).toBe(2000 + 60 * 1000);
  });

  it('rateLimitHitSlidingWindow fails closed on error', async () => {
    const mockUpstash = {
      multi: vi.fn(() => {
        throw new Error('Redis down');
      }),
    };
    const backend = new UpstashBackend(mockUpstash as any);
    const result = await backend.rateLimitHitSlidingWindow('rl:key', 60, 10, 2000);
    expect(result.count).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.resetAt).toBe(2000 + 60 * 1000);
  });
});
