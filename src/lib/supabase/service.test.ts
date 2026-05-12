import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getServiceSupabase } from './service';

const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

describe('getServiceSupabase', () => {
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

  it('returns null without url', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    expect(getServiceSupabase()).toBeNull();
  });

  it('returns null without service key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    expect(getServiceSupabase()).toBeNull();
  });

  it('returns null when both missing', () => {
    expect(getServiceSupabase()).toBeNull();
  });
});
