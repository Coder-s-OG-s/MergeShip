import type { Octokit } from '@octokit/rest';
import { cacheGet, cacheSet } from '../cache';

/**
 * GitHub fetch wrapper with ETag-based conditional requests + Redis cache.
 *
 * A 304 response from GitHub does NOT count against the rate limit. With this
 * wrapper, repeated reads of slow-changing data (issue lists, PR detail, repo
 * metadata) are effectively free.
 *
 * Key format: `gh:{namespace}:{path}` — pass the namespace explicitly so we
 * don't have collisions across endpoints.
 */

type CacheEntry<T> = {
  etag: string;
  body: T;
  cachedAt: number;
};

export type CachedRequestArgs<T> = {
  octokit: Octokit;
  cacheKey: string;
  ttlSeconds: number;
  request: (
    etag: string | null,
  ) => Promise<{ status: number; data: T; headers: { etag?: string } }>;
};

export async function cachedGhRequest<T>(args: CachedRequestArgs<T>): Promise<T> {
  const cached = await cacheGet<CacheEntry<T>>(args.cacheKey);

  try {
    const res = await args.request(cached?.etag ?? null);
    if (res.status === 304 && cached) {
      // Unchanged — refresh TTL to extend cache life without hitting GitHub again.
      await cacheSet(args.cacheKey, cached, args.ttlSeconds);
      return cached.body;
    }
    const entry: CacheEntry<T> = {
      etag: res.headers.etag ?? '',
      body: res.data,
      cachedAt: Date.now(),
    };
    await cacheSet(args.cacheKey, entry, args.ttlSeconds);
    return res.data;
  } catch (e) {
    // Soft-fail: return stale cache if available, otherwise rethrow.
    if (cached) return cached.body;
    throw e;
  }
}

/**
 * Helper for typed Octokit GET calls that participate in the ETag cache.
 */
export async function ghGet<T>(
  octokit: Octokit,
  url: string,
  params: Record<string, unknown>,
  cacheKey: string,
  ttlSeconds: number,
): Promise<T> {
  return cachedGhRequest<T>({
    octokit,
    cacheKey,
    ttlSeconds,
    request: async (etag) => {
      const headers = etag ? { 'if-none-match': etag } : undefined;
      const res = await octokit.request(`GET ${url}`, { ...params, headers });
      const respHeaders = res.headers as { etag?: string };
      return { status: res.status, data: res.data as T, headers: { etag: respHeaders.etag } };
    },
  });
}
