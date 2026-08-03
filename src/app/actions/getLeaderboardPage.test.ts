import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLeaderboardPage } from './getLeaderboardPage';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';

const mocks = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockRequireUser: vi.fn(),
  mockTryGetDb: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: mocks.mockCacheGet,
  cacheSet: mocks.mockCacheSet,
}));

vi.mock('@/lib/action-auth', () => ({
  requireUser: mocks.mockRequireUser,
}));

vi.mock('@/lib/db/client', () => ({
  tryGetDb: mocks.mockTryGetDb,
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));

describe('getLeaderboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('normalizes page and pageSize and returns cached data if available', async () => {
    const cachedData = {
      entries: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
    };
    mocks.mockCacheGet.mockResolvedValue(cachedData);

    // page 0 -> 1, pageSize 999 -> 100
    const res = await getLeaderboardPage(0, 999);

    expect(mocks.mockCacheGet).toHaveBeenCalledWith('leaderboard:global:all:public:100:1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual(cachedData);
    }
    expect(mocks.mockRequireUser).not.toHaveBeenCalled();
  });

  it('returns error if user is not authenticated or rate limited', async () => {
    mocks.mockCacheGet.mockResolvedValue(null);
    mocks.mockRequireUser.mockResolvedValue({ ok: false, error: { code: 'rate_limited' } });

    const res = await getLeaderboardPage(1, 20);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('rate_limited');
    }
  });

  it('returns not_configured if db is missing', async () => {
    mocks.mockCacheGet.mockResolvedValue(null);
    mocks.mockRequireUser.mockResolvedValue({ ok: true, data: { user: { id: 'user-1' } } });
    mocks.mockTryGetDb.mockReturnValue(null);

    const res = await getLeaderboardPage(1, 20);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_configured');
    }
  });

  it('queries database, maps results (including null fallbacks), and sets cache', async () => {
    mocks.mockCacheGet.mockResolvedValue(null);
    mocks.mockRequireUser.mockResolvedValue({ ok: true, data: { user: { id: 'user-1' } } });

    const mockExecute = vi
      .fn()
      .mockResolvedValueOnce([{ count: 42 }]) // countResult
      .mockResolvedValueOnce([
        // rowsResult
        {
          id: 'u1',
          github_handle: 'alice',
          display_name: 'Alice',
          avatar_url: 'http://alice.png',
          // testing null fallbacks
          xp: null,
          level: null,
          github_total_merges: null,
          github_streak: null,
          rank: 1,
        },
      ]);

    mocks.mockTryGetDb.mockReturnValue({ execute: mockExecute });

    const res = await getLeaderboardPage(2, 20);

    expect(mocks.mockRequireUser).toHaveBeenCalledWith({
      rateLimit: { namespace: 'leaderboard', ...RATE_LIMIT_TIERS.STANDARD },
      rateLimitMessage: 'too many leaderboard requests, slow down',
    });

    expect(mockExecute).toHaveBeenCalledTimes(2);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.totalCount).toBe(42);
      expect(res.data.page).toBe(2);
      expect(res.data.pageSize).toBe(20);
      expect(res.data.entries).toHaveLength(1);
      expect(res.data.entries[0]).toEqual({
        userId: 'u1',
        githubHandle: 'alice',
        displayName: 'Alice',
        avatarUrl: 'http://alice.png',
        xp: 0,
        level: 0,
        githubTotalMerges: 0,
        githubStreak: 0,
        rank: 1,
      });
      expect(mocks.mockCacheSet).toHaveBeenCalledWith(
        'leaderboard:global:all:public:20:2',
        res.data,
        600,
      );
    }
  });

  it('handles database execution errors gracefully', async () => {
    mocks.mockCacheGet.mockResolvedValue(null);
    mocks.mockRequireUser.mockResolvedValue({ ok: true, data: { user: { id: 'user-1' } } });

    const mockExecute = vi.fn().mockRejectedValue(new Error('connection lost'));
    mocks.mockTryGetDb.mockReturnValue({ execute: mockExecute });

    const res = await getLeaderboardPage(1, 20);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('database_error');
      expect(res.error.message).toBe('connection lost');
    }
  });
});
