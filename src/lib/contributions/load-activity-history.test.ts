import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadActivityHistory } from './load-activity-history';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn(),
}));

import { cacheGet } from '@/lib/cache';

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'not', 'is']) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  c.then = undefined;
  Object.assign(c, {
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  });
  return c;
}

describe('loadActivityHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheGet).mockResolvedValue(null);
  });

  it('prefers cached GitHub contribution calendar when present', async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      days: [
        { date: '2026-06-10', contributionCount: 3 },
        { date: '2026-06-11', contributionCount: 0 },
      ],
    });

    const history = await loadActivityHistory('user-1');
    expect(history).toEqual([{ date: '2026-06-10', count: 3 }]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('falls back to merged PRs and review xp events', async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: [{ created_at: '2026-06-12T10:00:00.000Z' }],
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: [{ merged_at: '2026-06-15T18:00:00.000Z' }],
        }),
      );

    const history = await loadActivityHistory('user-2');
    expect(history).toEqual([
      { date: '2026-06-12', count: 1 },
      { date: '2026-06-15', count: 1 },
    ]);
  });
});
