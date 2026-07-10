import { describe, expect, it, vi, beforeEach } from 'vitest';
import { normalizeRepoFilter, repoFilterPattern } from './issues-helpers';

describe('issue repo filtering helpers', () => {
  it('trims repo filters and treats blank input as unset', () => {
    expect(normalizeRepoFilter('  AYUSH-PATEL-56/KYVERNO  ')).toBe('AYUSH-PATEL-56/KYVERNO');
    expect(normalizeRepoFilter('   ')).toBeNull();
    expect(normalizeRepoFilter()).toBeNull();
  });

  it('escapes wildcard characters before using an ilike repo filter', () => {
    expect(repoFilterPattern('owner/repo_name')).toBe('owner/repo\\_name');
    expect(repoFilterPattern('owner/100%coverage')).toBe('owner/100\\%coverage');
    expect(repoFilterPattern('owner\\repo')).toBe('owner\\\\repo');
  });
});

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSession: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockGetInstallOctokit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mocks.mockGetUser,
      getSession: mocks.mockGetSession,
    },
  })),
}));

vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: mocks.mockGetInstallOctokit,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: mocks.mockServiceFrom,
  })),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

import { getIssuesPage, getRepoOptions } from './issues';

const createMockChain = (result: unknown) => {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return chain;
};

describe('getRepoOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mocks.mockGetSession.mockResolvedValue({
      data: { session: null },
    });
    mocks.mockGetInstallOctokit.mockResolvedValue({
      repos: { get: vi.fn().mockResolvedValue({ data: {} }) },
    });
  });

  it('returns empty array when user has no installations', async () => {
    mocks.mockServiceFrom.mockReturnValueOnce(createMockChain({ data: [] }));

    const result = await getRepoOptions();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('resolves forks using getInstallOctokit', async () => {
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'github_installations') {
        return createMockChain({ data: [{ id: 10 }] });
      }
      if (table === 'installation_repositories') {
        return createMockChain({
          data: [{ repo_full_name: 'owner/fork-repo', installation_id: 10 }],
        });
      }
      return createMockChain({ data: [] });
    });

    const mockReposGet = vi.fn().mockResolvedValue({
      data: { fork: true, parent: { full_name: 'owner/parent-repo' } },
    });
    mocks.mockGetInstallOctokit.mockResolvedValue({
      repos: { get: mockReposGet },
    });

    const result = await getRepoOptions();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ label: 'owner/fork-repo', value: 'owner/parent-repo' }]);
    }
    expect(mocks.mockGetInstallOctokit).toHaveBeenCalledWith(10);
    expect(mockReposGet).toHaveBeenCalledWith({ owner: 'owner', repo: 'fork-repo' });
  });

  it('keeps original repo label if octokit throws an error during fork resolution (error-fallback)', async () => {
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'github_installations') {
        return createMockChain({ data: [{ id: 10 }] });
      }
      if (table === 'installation_repositories') {
        return createMockChain({
          data: [{ repo_full_name: 'owner/error-repo', installation_id: 10 }],
        });
      }
      return createMockChain({ data: [] });
    });

    const mockReposGet = vi.fn().mockRejectedValue(new Error('GitHub API Error'));
    mocks.mockGetInstallOctokit.mockResolvedValue({
      repos: { get: mockReposGet },
    });

    const result = await getRepoOptions();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ label: 'owner/error-repo', value: 'owner/error-repo' }]);
    }
    expect(mocks.mockGetInstallOctokit).toHaveBeenCalledWith(10);
    expect(mockReposGet).toHaveBeenCalledWith({ owner: 'owner', repo: 'error-repo' });
  });
});

describe('getIssuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mocks.mockGetSession.mockResolvedValue({
      data: { session: null },
    });
    mocks.mockGetInstallOctokit.mockResolvedValue({
      repos: { get: vi.fn().mockResolvedValue({ data: {} }) },
    });
  });

  it('returns empty result set when user has no installations', async () => {
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'github_installations') {
        return createMockChain({ data: [] });
      }
      return createMockChain({ data: [] });
    });

    const result = await getIssuesPage({});

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.issues).toEqual([]);
      expect(result.data.total).toBe(0);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it('returns scoped issues from user installed repos', async () => {
    const mockChain = createMockChain({
      data: [
        {
          id: 45,
          repo_full_name: 'owner/allowed-repo',
          title: 'Scoped Issue',
          github_issue_number: 1,
          difficulty: 'E',
          xp_reward: 100,
          labels: [],
          state: 'open',
          url: 'https://github.com/owner/allowed-repo/issues/1',
          fetched_at: '2026-05-18T00:00:00Z',
        },
      ],
      count: 1,
      error: null,
    });

    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'github_installations') {
        return createMockChain({ data: [{ id: 10 }] });
      }
      if (table === 'installation_repositories') {
        return createMockChain({
          data: [{ repo_full_name: 'owner/allowed-repo', installation_id: 10 }],
        });
      }
      if (table === 'issues') {
        return mockChain;
      }
      return createMockChain({ data: [] });
    });

    const result = await getIssuesPage({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.issues).toHaveLength(1);
      expect(result.data.issues[0]?.title).toBe('Scoped Issue');
      expect(mockChain.in).toHaveBeenCalledWith('repo_full_name', ['owner/allowed-repo']);
    }
  });

  it('applies Highest XP sorting correctly', async () => {
    const mockChain = createMockChain({
      data: [],
      count: 0,
      error: null,
    });

    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'github_installations') {
        return createMockChain({ data: [{ id: 10 }] });
      }
      if (table === 'installation_repositories') {
        return createMockChain({
          data: [{ repo_full_name: 'owner/allowed-repo', installation_id: 10 }],
        });
      }
      if (table === 'issues') {
        return mockChain;
      }
      return createMockChain({ data: [] });
    });

    await getIssuesPage({ sort: 'xp_desc' });

    expect(mockChain.order).toHaveBeenCalledWith('xp_reward', {
      ascending: false,
      nullsFirst: false,
    });
  });

  it('applies Lowest XP sorting correctly', async () => {
    const mockChain = createMockChain({
      data: [],
      count: 0,
      error: null,
    });

    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'github_installations') {
        return createMockChain({ data: [{ id: 10 }] });
      }
      if (table === 'installation_repositories') {
        return createMockChain({
          data: [{ repo_full_name: 'owner/allowed-repo', installation_id: 10 }],
        });
      }
      if (table === 'issues') {
        return mockChain;
      }
      return createMockChain({ data: [] });
    });

    await getIssuesPage({ sort: 'xp_asc' });

    expect(mockChain.order).toHaveBeenCalledWith('xp_reward', {
      ascending: true,
      nullsFirst: false,
    });
  });
});
