import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBrowserSupabase, isSupabaseConfigured } from './browser';

const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

describe('getBrowserSupabase', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('returns null when env missing', () => {
    expect(getBrowserSupabase()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('returns a client when env present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    expect(getBrowserSupabase()).not.toBeNull();
    expect(isSupabaseConfigured()).toBe(true);
  });
});
