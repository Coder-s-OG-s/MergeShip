/**
 * Cache abstraction. Production = Redis (Official Redis for Vercel / Upstash-compatible).
 * Tests + local dev = in-memory map (no network, deterministic).
 *
 * IMPORTANT: MemoryBackend must NOT be used in production for rate limiting.
 * In a serverless (Vercel Lambda) deployment every function invocation runs in
 * an isolated process. A MemoryBackend counter is process-local, so it resets
 * on every cold-start and is never shared across concurrent invocations. The
 * effective rate limit becomes unlimited.
 *
 * Set at least one of these environment variables before deploying:
 *   KV_REST_API_URL + KV_REST_API_TOKEN  (Upstash / Vercel KV)
 *   REDIS_URL                            (standard Redis / ioredis)
 *
 * Swap providers later by replacing the backend below -- call sites never change.
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  scanDel(prefix: string): Promise<void>;
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
}

/**
 * Whether the current backend is a real shared cache (Redis or Upstash).
 * Rate-limit callers can check this to warn operators when limits are not enforced.
 */
export let isSharedCacheAvailable = false;

let backend: CacheBackend = pickDefaultBackend();

function pickDefaultBackend(): CacheBackend {
  const upstashUrl = process.env.KV_REST_API_URL;
  const upstashToken = process.env.KV_REST_API_TOKEN;
  if (upstashUrl && upstashToken) {
    isSharedCacheAvailable = true;
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
      isSharedCacheAvailable = false;
      backend = new MemoryBackend();
      client.disconnect();
    });
    isSharedCacheAvailable = true;
    return new IoRedisBackend(client);
  }

  // No Redis configuration found. MemoryBackend is process-local and resets on
  // every Lambda cold-start, which means rate limits are NOT enforced across
  // concurrent invocations in a serverless deployment.
  //
  // In production this is a misconfiguration. Log an error so the operator is
  // alerted during deployment. The app continues to function -- rate limiting
  // is simply disabled -- rather than crashing, to avoid a hard outage.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[cache] MISCONFIGURATION: No Redis backend configured in production. ' +
        'Rate limiting is disabled. Set KV_REST_API_URL + KV_REST_API_TOKEN ' +
        '(Upstash) or REDIS_URL (ioredis) to enable shared-state rate limiting.',
    );
  }

  isSharedCacheAvailable = false;
  return new MemoryBackend();
}

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
