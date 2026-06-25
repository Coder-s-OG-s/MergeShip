import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockExecute: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockPaginate: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}));

vi.mock('@/lib/db/client', () => ({
  tryGetDb: vi.fn(() => ({
    execute: mocks.mockExecute,
  })),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: mocks.mockCacheGet,
  cacheSet: mocks.mockCacheSet,
}));

vi.mock('@/lib/github/app', () => ({
  getAppOctokit: vi.fn(() => ({
    paginate: mocks.mockPaginate,
    request: mocks.mockRequest,
    users: {
      listFollowingForUser: 'listFollowingForUser',
    },
  })),
  getInstallOctokit: vi.fn(() => ({
    paginate: mocks.mockPaginate,
    request: mocks.mockRequest,
    users: {
      listFollowingForUser: 'listFollowingForUser',
    },
  })),
}));

import { getLeaderboard } from './leaderboard';
import { getAppOctokit, getInstallOctokit } from '@/lib/github/app';
import { isOk } from '@/lib/result';

describe('getLeaderboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          identities: [{ provider: 'github', identity_data: { user_name: 'alice' } }],
        },
      },
    });
    mocks.mockCacheGet.mockResolvedValue(null);
  });

  it('successfully fetches global leaderboard', async () => {
    const mockRows = [
      {
        id: 'user-1',
        github_handle: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        xp: 500,
        level: 3,
        github_total_merges: 10,
        github_streak: 5,
        rank: 1,
      },
    ];
    mocks.mockExecute.mockResolvedValueOnce(mockRows); // rows query

    const result = await getLeaderboard('global', null, 50);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.entries[0]?.githubHandle).toBe('alice');
      expect(result.data.currentUserRank?.rank).toBe(1);
    }
  });

  it('successfully fetches monthly leaderboard', async () => {
    const mockRows = [
      {
        id: 'user-1',
        github_handle: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        xp: 200,
        level: 3,
        github_total_merges: 10,
        github_streak: 5,
        rank: 1,
      },
    ];
    mocks.mockExecute.mockResolvedValueOnce(mockRows); // rows query

    const result = await getLeaderboard('monthly', null, 50);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.entries[0]?.xp).toBe(200);
      expect(result.data.currentUserRank?.userId).toBe('user-1');
    }
  });

  it('successfully fetches friends leaderboard', async () => {
    const mockRows = [
      {
        id: 'user-1',
        github_handle: 'alice',
        display_name: 'Alice',
        avatar_url: null,
        xp: 500,
        level: 3,
        github_total_merges: 10,
        github_streak: 5,
        rank: 1,
      },
      {
        id: 'user-2',
        github_handle: 'bob',
        display_name: 'Bob',
        avatar_url: null,
        xp: 400,
        level: 2,
        github_total_merges: 5,
        github_streak: 2,
        rank: 2,
      },
    ];
    mocks.mockPaginate.mockResolvedValue([{ login: 'bob' }]);
    mocks.mockExecute.mockResolvedValueOnce([]); // no installations lookup
    mocks.mockExecute.mockResolvedValueOnce(mockRows); // rows query

    const result = await getLeaderboard('friends', null, 50);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.entries).toHaveLength(2);
      expect(result.data.entries[1]?.githubHandle).toBe('bob');
    }
  });

  describe('friends leaderboard', () => {
    const setupRequestLoopOctokit = () => {
      const octokit = {
        paginate: async (_method: unknown, opts: { username: string; per_page?: number }) => {
          const MAX_PAGES = 5;
          let page = 1;
          const collected: { login: string }[] = [];
          while (page <= MAX_PAGES) {
            const { data } = await mocks.mockRequest('GET /users/{username}/following', {
              username: opts.username,
              per_page: opts.per_page ?? 100,
              page,
            });
            collected.push(...(data ?? []));
            if (!data || data.length < 100) break;
            page++;
          }
          return collected;
        },
        request: mocks.mockRequest,
        users: { listFollowingForUser: 'listFollowingForUser' },
      };
      vi.mocked(getAppOctokit).mockReturnValue(octokit as ReturnType<typeof getAppOctokit>);
      vi.mocked(getInstallOctokit).mockResolvedValue(
        octokit as Awaited<ReturnType<typeof getInstallOctokit>>,
      );
    };

    const setupFollowingCache = () => {
      let followingCache: string[] | null = null;
      mocks.mockCacheGet.mockImplementation(async (key: string) => {
        if (key === 'leaderboard:friends:all:user-1:50') return null;
        if (key === 'user:following:user-1') return followingCache;
        return null;
      });
      mocks.mockCacheSet.mockImplementation(async (key: string, value: string[]) => {
        if (key === 'user:following:user-1') followingCache = value;
      });
    };

    it('stops paginating when a page returns fewer than 100 results', async () => {
      setupRequestLoopOctokit();
      setupFollowingCache();

      const page1 = Array.from({ length: 100 }, (_, i) => ({ login: `user${i}` }));
      const page2 = [{ login: 'bob' }, { login: 'carol' }, { login: 'dave' }];

      mocks.mockRequest
        .mockResolvedValueOnce({ data: page1 })
        .mockResolvedValueOnce({ data: page2 });

      mocks.mockExecute.mockResolvedValueOnce([]); // installations lookup → no install, use app token
      mocks.mockExecute.mockResolvedValueOnce([]); // main leaderboard rows query
      mocks.mockExecute.mockResolvedValueOnce([{ rank: 1 }]); // current-user rank query
      mocks.mockExecute.mockResolvedValueOnce([
        {
          id: 'user-1',
          github_handle: 'alice',
          display_name: 'Alice',
          avatar_url: null,
          xp: 0,
          level: 0,
          github_total_merges: 0,
          github_streak: 0,
        },
      ]); // current-user profile query

      await getLeaderboard('friends', null, 50);

      expect(mocks.mockRequest).toHaveBeenCalledTimes(2);
    });

    it('stops at 5 pages even when every page returns 100 results', async () => {
      setupRequestLoopOctokit();
      setupFollowingCache();

      const fullPage = Array.from({ length: 100 }, (_, i) => ({ login: `user${i}` }));

      mocks.mockRequest.mockResolvedValue({ data: fullPage });

      mocks.mockExecute.mockResolvedValueOnce([]); // installations lookup
      mocks.mockExecute.mockResolvedValueOnce([]); // main leaderboard rows query
      mocks.mockExecute.mockResolvedValueOnce([{ rank: 1 }]); // current-user rank query
      mocks.mockExecute.mockResolvedValueOnce([
        {
          id: 'user-1',
          github_handle: 'alice',
          display_name: 'Alice',
          avatar_url: null,
          xp: 0,
          level: 0,
          github_total_merges: 0,
          github_streak: 0,
        },
      ]); // current-user profile query

      await getLeaderboard('friends', null, 50);

      expect(mocks.mockRequest).toHaveBeenCalledTimes(5);
    });
  });
});
