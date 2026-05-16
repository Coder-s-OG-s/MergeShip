import { vi } from 'vitest';
import { getServiceSupabase } from '@/lib/supabase/service';

// Chainable Supabase mock.
export const sb = (t: Record<string, unknown> = {}) => {
  const c: Record<string, unknown> = {};
  for (const m of [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'not',
    'order',
    'limit',
    'upsert',
    'update',
    'insert',
    'delete',
  ])
    c[m] = vi.fn(() => c);
  c.maybeSingle = vi.fn().mockResolvedValue({ data: null });
  return Object.assign(c, t);
};

// Wire table mocks into a fake Supabase client.
export const wire = (tables: Record<string, ReturnType<typeof sb>>) => {
  const client = { from: vi.fn((t: string) => tables[t] ?? sb()) };
  vi.mocked(getServiceSupabase).mockReturnValue(client as never);
};

// Execute the callback immediately to simulate step.run.
export const step = { run: <T>(_n: string, fn: () => Promise<T>) => fn() };
