/**
 * Cache abstraction. Production = Redis (Official Redis for Vercel / Upstash-compatible).
 * Tests + local dev = in-memory map (no network, deterministic).
 *
 * Swap providers later by replacing the backend below — call sites never change.
 */

import { Redis } from '@upstash/redis';

interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
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

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const hit = this.store.get(key);
    const current = hit && hit.expiresAt > now && typeof hit.value === 'number' ? hit.value : 0;
    const next = current + 1;
    this.store.set(key, { value: next, expiresAt: now + ttlSeconds * 1000 });
    return next;
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

class UpstashBackend implements CacheBackend {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const v = await this.redis.get<T>(key);
    return v ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.redis.set(key, value, { ex: ttlSeconds });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async scanDel(prefix: string): Promise<void> {
    let cursor: string | number = 0;
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
  }
}

let backend: CacheBackend = pickDefaultBackend();

function pickDefaultBackend(): CacheBackend {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return new MemoryBackend();
  return new UpstashBackend(new Redis({ url, token }));
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

export function cacheIncr(key: string, ttlSeconds: number): Promise<number> {
  return backend.incr(key, ttlSeconds);
}

export function cacheDel(key: string): Promise<void> {
  return backend.del(key);
}

export function cacheDelByPrefix(prefix: string): Promise<void> {
  return backend.scanDel(prefix);
}
