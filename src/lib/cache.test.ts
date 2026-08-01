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

const redisRegistry = vi.hoisted(() => ({
  instance: null as any,
  options: null as any,
  handlers: new Map<string, (err?: Error) => void>(),
}));

vi.mock('ioredis', () => ({
  default: class MockRedis {
    on = vi.fn((event: string, handler: (err?: Error) => void) => {
      redisRegistry.handlers.set(event, handler);
      return this;
    });
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue('OK');
    del = vi.fn().mockResolvedValue(1);
    scan = vi.fn().mockResolvedValue(['0', []]);
    incr = vi.fn().mockResolvedValue(1);
    expire = vi.fn().mockResolvedValue(1);
    ttl = vi.fn().mockResolvedValue(60);
    constructor(_url: string, options?: unknown) {
      redisRegistry.instance = this;
      redisRegistry.options = options;
    }
  },
}));

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

describe('pickDefaultBackend (REDIS_URL path) — regression for #843', () => {
  it('keeps routing through the same IoRedisBackend after a redis error event', async () => {
    vi.resetModules();
    const prevUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Fresh module load picks the IoRedis backend via REDIS_URL.
      const cache = await import('./cache');

      const redis = redisRegistry.instance;
      expect(redis).not.toBeNull();
      expect(redis.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Emit a synthetic redis error event (the exact path the bug lived in).
      const errorHandler = redisRegistry.handlers.get('error');
      expect(errorHandler).toBeDefined();
      errorHandler?.(new Error('ECONNREFUSED'));
      expect(warnSpy).toHaveBeenCalled();

      // cacheGet must still route through the same IoRedis client, not swap
      // to a MemoryBackend.
      await cache.cacheGet('regression-key');
      expect(redis.get).toHaveBeenCalledWith('regression-key');

      // Rate limiting must still route through the same IoRedis client.
      await cache.cacheRateLimitHit('regression-rl', 60, 1000);
      expect(redis.incr).toHaveBeenCalledWith('regression-rl');
    } finally {
      if (prevUrl) process.env.REDIS_URL = prevUrl;
      else delete process.env.REDIS_URL;
      warnSpy.mockRestore();
    }
  });
});

describe('pickDefaultBackend fail-closed (regression for #861)', () => {
  function withEnv(
    env: Record<string, string | undefined>,
    fn: () => Promise<void>,
  ): Promise<void> {
    const prev = new Map<string, string | undefined>();
    return (async () => {
      for (const [k, v] of Object.entries(env)) {
        prev.set(k, process.env[k]);
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      try {
        await fn();
      } finally {
        for (const [k, v] of prev) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    })();
  }

  it('blocks all rate-limit hits on a production deploy with no shared cache', async () => {
    await withEnv(
      {
        KV_REST_API_URL: undefined,
        KV_REST_API_TOKEN: undefined,
        REDIS_URL: undefined,
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
      },
      async () => {
        vi.resetModules();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          const cache = await import('./cache');

          const fixed = await cache.cacheRateLimitHit('rl:prod', 60, 1000);
          expect(fixed.count).toBe(Number.MAX_SAFE_INTEGER);
          expect(fixed.resetAt).toBe(1000 + 60 * 1000);

          const sliding = await cache.cacheRateLimitHitSlidingWindow('rl:prod', 60, 5, 2000);
          expect(sliding.count).toBe(Number.MAX_SAFE_INTEGER);
          expect(sliding.resetAt).toBe(2000 + 60 * 1000);
        } finally {
          errorSpy.mockRestore();
        }
      },
    );
  });

  it('makes non-rate-limit cache ops safe no-ops when failing closed', async () => {
    await withEnv(
      {
        KV_REST_API_URL: undefined,
        KV_REST_API_TOKEN: undefined,
        REDIS_URL: undefined,
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
      },
      async () => {
        vi.resetModules();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          const cache = await import('./cache');
          await cache.cacheSet('k', 'v', 60);
          expect(await cache.cacheGet('k')).toBeNull();
          await cache.cacheDel('k');
          await cache.cacheDelByPrefix('k:');
        } finally {
          errorSpy.mockRestore();
        }
      },
    );
  });

  it('keeps the memory backend on a Vercel preview deploy without a shared cache', async () => {
    await withEnv(
      {
        KV_REST_API_URL: undefined,
        KV_REST_API_TOKEN: undefined,
        REDIS_URL: undefined,
        VERCEL_ENV: 'preview',
        NODE_ENV: 'production',
      },
      async () => {
        vi.resetModules();
        const cache = await import('./cache');
        const result = await cache.cacheRateLimitHit('rl:preview', 60, 1000);
        expect(result.count).toBe(1);
      },
    );
  });

  it('configures a bounded reconnect retryStrategy instead of giving up permanently', async () => {
    await withEnv({ REDIS_URL: 'redis://localhost:6379' }, async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await import('./cache');
        expect(redisRegistry.options).not.toBeNull();
        const retryStrategy = redisRegistry.options?.retryStrategy as (
          times: number,
        ) => number | null;
        expect(retryStrategy).toBeTypeOf('function');
        expect(retryStrategy(1)).toBeGreaterThanOrEqual(250);
        expect(retryStrategy(1)).toBeLessThanOrEqual(5000);
        expect(retryStrategy(10)).toBeLessThanOrEqual(5000);
        expect(retryStrategy(11)).toBeNull();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
