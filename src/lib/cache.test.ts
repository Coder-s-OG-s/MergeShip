import { describe, it, expect, beforeEach } from 'vitest';
import { __setMemoryCache, cacheGet, cacheSet, cacheDel, cacheDelByPrefix } from './cache';

beforeEach(() => __setMemoryCache());

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
