import { describe, it, expect, beforeEach } from 'vitest';
import { cachedGhRequest } from './api';
import { cacheDelByPrefix } from '../cache';
import type { Octokit } from '@octokit/rest';

const octokit = {} as Octokit;

describe('cachedGhRequest', () => {
  beforeEach(async () => {
    await cacheDelByPrefix('test:');
  });

  it('caches the body on first call (200 + etag)', async () => {
    let calls = 0;
    const body = await cachedGhRequest<{ ok: number }>({
      octokit,
      cacheKey: 'test:k1',
      ttlSeconds: 60,
      request: async () => {
        calls++;
        return { status: 200, data: { ok: 1 }, headers: { etag: 'W/"e1"' } };
      },
    });
    expect(body).toEqual({ ok: 1 });
    expect(calls).toBe(1);
  });

  it('returns cached body on 304 and forwards previous etag', async () => {
    let seenEtag: string | null = null;

    await cachedGhRequest<{ ok: number }>({
      octokit,
      cacheKey: 'test:k2',
      ttlSeconds: 60,
      request: async () => ({ status: 200, data: { ok: 1 }, headers: { etag: 'W/"e2"' } }),
    });

    const body = await cachedGhRequest<{ ok: number }>({
      octokit,
      cacheKey: 'test:k2',
      ttlSeconds: 60,
      request: async (etag) => {
        seenEtag = etag;
        return { status: 304, data: null as unknown as { ok: number }, headers: {} };
      },
    });

    expect(seenEtag).toBe('W/"e2"');
    expect(body).toEqual({ ok: 1 });
  });

  it('returns stale cache when request throws', async () => {
    await cachedGhRequest<{ ok: number }>({
      octokit,
      cacheKey: 'test:k3',
      ttlSeconds: 60,
      request: async () => ({ status: 200, data: { ok: 7 }, headers: { etag: 'W/"e3"' } }),
    });

    const body = await cachedGhRequest<{ ok: number }>({
      octokit,
      cacheKey: 'test:k3',
      ttlSeconds: 60,
      request: async () => {
        throw new Error('network down');
      },
    });

    expect(body).toEqual({ ok: 7 });
  });

  it('rethrows when no cache and request throws', async () => {
    await expect(
      cachedGhRequest<unknown>({
        octokit,
        cacheKey: 'test:k4',
        ttlSeconds: 60,
        request: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow('boom');
  });
});
