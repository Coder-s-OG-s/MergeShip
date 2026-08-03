import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDailyChallenge } from './daily-challenge';
import { eq, and } from 'drizzle-orm';
import { schema } from '@/lib/db/client';

const mocks = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetActiveChallenge: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: mocks.mockGetServerSupabase,
}));

vi.mock('@/lib/db/client', () => ({
  getDb: mocks.mockGetDb,
  schema: {
    userChallengeProgress: { userId: 'user_id', date: 'date' },
  },
}));

vi.mock('@/lib/daily-challenge/progress', () => ({
  getActiveChallenge: mocks.mockGetActiveChallenge,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.mockRateLimit,
  RATE_LIMIT_TIERS: { GENEROUS: { limit: 100, windowSec: 60 } },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

describe('getDailyChallenge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetServerSupabase.mockReturnValue({
      auth: { getUser: mocks.mockGetUser },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns not_configured if supabase is not available', async () => {
    mocks.mockGetServerSupabase.mockReturnValue(null);
    const res = await getDailyChallenge();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_configured');
  });

  it('returns unauthenticated if user is not signed in', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await getDailyChallenge();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_authenticated');
  });

  it('returns rate_limited if rate limit is exceeded', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mocks.mockRateLimit.mockResolvedValue({ ok: false });
    const res = await getDailyChallenge();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('rate_limited');
  });

  it('returns not_found if there is no active challenge', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockGetActiveChallenge.mockResolvedValue(null);

    const mockDb = {};
    mocks.mockGetDb.mockReturnValue(mockDb);

    const res = await getDailyChallenge();

    expect(mocks.mockRateLimit).toHaveBeenCalledWith({
      namespace: 'daily-challenge:get',
      key: 'u1',
      limit: 100,
      windowSec: 60,
    });
    expect(mocks.mockGetActiveChallenge).toHaveBeenCalledWith(mockDb);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  it('returns challenge data and user progress if active challenge exists', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    mocks.mockGetActiveChallenge.mockResolvedValue({
      title: 'Merge 1 PR',
      description: 'Test description',
      goal: 1,
      xpReward: 50,
    });

    const mockLimit = vi.fn().mockResolvedValue([{ current: 1, completed: true }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    const mockDb = { select: mockSelect };
    mocks.mockGetDb.mockReturnValue(mockDb);

    const res = await getDailyChallenge();

    // Validate drizzle query structure
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith(schema.userChallengeProgress);
    expect(mockWhere).toHaveBeenCalledWith({
      type: 'and',
      args: [
        { type: 'eq', col: 'user_id', val: 'u1' },
        { type: 'eq', col: 'date', val: '2026-08-01' },
      ],
    });
    expect(mockLimit).toHaveBeenCalledWith(1);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({
        title: 'Merge 1 PR',
        description: 'Test description',
        goal: 1,
        current: 1,
        xpReward: 50,
        completed: true,
      });
    }
  });

  it('returns 0 progress if user has no progress record today', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    mocks.mockGetActiveChallenge.mockResolvedValue({
      title: 'Merge 1 PR',
      description: 'Test description',
      goal: 1,
      xpReward: 50,
    });

    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    mocks.mockGetDb.mockReturnValue({ select: mockSelect });

    const res = await getDailyChallenge();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({
        title: 'Merge 1 PR',
        description: 'Test description',
        goal: 1,
        current: 0,
        xpReward: 50,
        completed: false,
      });
    }
  });
});
