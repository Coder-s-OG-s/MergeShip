import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readSupabaseEnv, readServiceEnv } from './env';

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

describe('readSupabaseEnv', () => {
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

  it('returns null when URL is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    expect(readSupabaseEnv()).toBeNull();
  });

  it('returns null when anon key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    expect(readSupabaseEnv()).toBeNull();
  });

  it('returns config when both set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    expect(readSupabaseEnv()).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon' });
  });
});

describe('readServiceEnv', () => {
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

  it('returns null without service role key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    expect(readServiceEnv()).toBeNull();
  });

  it('returns null without URL', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    expect(readServiceEnv()).toBeNull();
  });

  it('returns config when both set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    expect(readServiceEnv()).toEqual({ url: 'https://x.supabase.co', serviceKey: 'svc' });
  });
});
