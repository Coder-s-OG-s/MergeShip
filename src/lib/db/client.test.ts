import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('db client', () => {
  const saved = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it('tryGetDb returns null when DATABASE_URL is missing', async () => {
    const { tryGetDb, isDbConfigured } = await import('./client');
    expect(tryGetDb()).toBeNull();
    expect(isDbConfigured()).toBe(false);
  });

  it('getDb throws when DATABASE_URL is missing', async () => {
    const { getDb } = await import('./client');
    expect(() => getDb()).toThrow(/DATABASE_URL/);
  });

  it('isDbConfigured is true when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://x';
    const { isDbConfigured } = await import('./client');
    expect(isDbConfigured()).toBe(true);
  });
});
