/**
 * Cache abstraction. Production = Redis (Official Redis for Vercel / Upstash-compatible).
 * Tests + local dev = in-memory map (no network, deterministic).
 *
 * Swap providers later by replacing the backend below — call sites never change.
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  scanDel(prefix: string): Promise<void>;
  rateLimitHit(key: string, windowSec: number, now: number): Promise<RateLimitBucket>;
}

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

function rateLimitResetAt(ttlSeconds: number, windowSec: number, now: number): number {
  return now + Math.max(1, ttlSeconds > 0 ? ttlSeconds : windowSec) * 1000;
}

function blockedRateLimitBucket(windowSec: number, now: number): RateLimitBucket {
  return { count: Number.MAX_SAFE_INTEGER, resetAt: now + windowSec * 1000 };
}

class MemoryBackend implements CacheBackend {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async scanDel(prefix: string): Promise<void> {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  async rateLimitHit(key: string, windowSec: number, now: number): Promise<RateLimitBucket> {
    const hit = this.store.get(key);
    const count = typeof hit?.value === 'number' ? hit.value : 0;
    const expired = !hit || hit.expiresAt <= now || count <= 0;

    if (expired) {
      const resetAt = now + windowSec * 1000;
      this.store.set(key, { value: 1, expiresAt: resetAt });
      return { count: 1, resetAt };
    }

    const next = count + 1;
    this.store.set(key, { value: next, expiresAt: hit.expiresAt });
    return { count: next, resetAt: hit.expiresAt };
  }
}

export class UpstashBackend implements CacheBackend {
  constructor(private redis: UpstashRedis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await this.redis.get<T>(key);
      return v ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await this.redis.set(key, value, { ex: ttlSeconds });
    } catch {
      // ignore
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // ignore
    }
  }

  async scanDel(prefix: string): Promise<void> {
    let cursor: string | number = 0;
    try {
      while (true) {
        const result: [string | number, string[]] = await this.redis.scan(cursor, {
          match: `${prefix}*`,
          count: 100,
        });
        const nextCursor = result[0];
        const keys = result[1];
        if (keys.length > 0) await this.redis.del(...keys);
        if (nextCursor === 0 || nextCursor === '0') break;
        cursor = nextCursor;
      }
    } catch {
      // ignore
    }
  }

  async rateLimitHit(key: string, windowSec: number, now: number): Promise<RateLimitBucket> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, windowSec);
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) await this.redis.expire(key, windowSec);
      return { count, resetAt: rateLimitResetAt(ttl, windowSec, now) };
    } catch {
      return blockedRateLimitBucket(windowSec, now);
    }
  }
}

export class IoRedisBackend implements CacheBackend {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await this.redis.get(key);
      if (!v) return null;
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // ignore
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // ignore
    }
  }

  async scanDel(prefix: string): Promise<void> {
    let cursor = '0';
    try {
      while (true) {
        const result = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) await this.redis.del(...keys);
        if (cursor === '0') break;
      }
    } catch {
      // ignore
    }
  }

  async rateLimitHit(key: string, windowSec: number, now: number): Promise<RateLimitBucket> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, windowSec);
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) await this.redis.expire(key, windowSec);
      return { count, resetAt: rateLimitResetAt(ttl, windowSec, now) };
    } catch {
      return blockedRateLimitBucket(windowSec, now);
    }
  }
}

let backend: CacheBackend = pickDefaultBackend();

function pickDefaultBackend(): CacheBackend {
  const upstashUrl = process.env.KV_REST_API_URL;
  const upstashToken = process.env.KV_REST_API_TOKEN;
  if (upstashUrl && upstashToken) {
    return new UpstashBackend(new UpstashRedis({ url: upstashUrl, token: upstashToken }));
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Do not keep retrying connection
    });
    client.on('error', (err: Error) => {
      console.warn(`[cache] Local Redis error: ${err.message}. Falling back to memory.`);
      backend = new MemoryBackend();
      client.disconnect();
    });
    return new IoRedisBackend(client);
  }

  // No distributed backend configured. Fall back to in-process MemoryBackend.
  // In Vercel (and any other serverless runtime), each function invocation runs
  // in an isolated process with its own memory, so counters are never shared
  // across concurrent invocations. Rate limiting is effectively disabled.
  // Set KV_REST_API_URL + KV_REST_API_TOKEN (Upstash) or REDIS_URL to enable
  // shared, durable rate limiting.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[cache] MISCONFIGURATION: No Redis or Upstash backend is configured. ' +
        'Falling back to MemoryBackend. Rate limiting is NOT shared across ' +
        'serverless invocations and is effectively disabled in production. ' +
        'Set KV_REST_API_URL + KV_REST_API_TOKEN (Upstash) or REDIS_URL.',
    );
  }
  return new MemoryBackend();
}

/** True when a distributed cache backend (Upstash or Redis) is configured. */
export const isSharedCacheAvailable: boolean = (() => {
  const hasUpstash = Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN);
  const hasRedis = Boolean(process.env.REDIS_URL);
  return hasUpstash || hasRedis;
})();

// Test-only hook. Resets to a fresh memory map between tests.
export function __setMemoryCache(): void {
  backend = new MemoryBackend();
}

export function cacheGet<T>(key: string): Promise<T | null> {
  return backend.get<T>(key);
}

export function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  return backend.set(key, value, ttlSeconds);
}

export function cacheDel(key: string): Promise<void> {
  return backend.del(key);
}

export function cacheDelByPrefix(prefix: string): Promise<void> {
  return backend.scanDel(prefix);
}

export function cacheRateLimitHit(
  key: string,
  windowSec: number,
  now: number,
): Promise<RateLimitBucket> {
  return backend.rateLimitHit(key, windowSec, now);
}
