import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoUnclaimStale } from './maintenance';
import { sb, wire, step } from './test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = autoUnclaimStale as unknown as (ctx: {
  step: typeof step;
}) => Promise<{ unclaimed: number; warned: number }>;

describe('autoUnclaimStale', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unclaims stale recommendations and logs activity, warns day-10 users', async () => {
    const updateMock = vi.fn().mockResolvedValue({
      data: [{ id: 1, user_id: 'u1' }],
      error: null,
    });
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ id: 2, user_id: 'u2' }],
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const recsTableMock = sb({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            lt: vi.fn(() => ({
              select: updateMock,
            })),
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            gte: vi.fn(() => ({
              lt: selectMock,
            })),
          })),
        })),
      })),
    });

    const activityLogTableMock = sb({
      insert: insertMock,
    });

    wire({
      recommendations: recsTableMock,
      activity_log: activityLogTableMock,
    });

    const result = await run({ step });

    expect(result).toEqual({ unclaimed: 1, warned: 1 });
    expect(updateMock).toHaveBeenCalled();
    expect(selectMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(2);
  });
});
