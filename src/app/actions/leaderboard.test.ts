import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockExecute: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockPaginate: vi.fn(),
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
    users: {
      listFollowingForUser: 'listFollowingForUser',
    },
  })),
  getInstallOctokit: vi.fn(() => ({
    paginate: mocks.mockPaginate,
    users: {
      listFollowingForUser: 'listFollowingForUser',
    },
  })),
}));

import { getLeaderboard } from './leaderboard';
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
});
