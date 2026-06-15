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
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mocks.mockGetUser,
      getSession: mocks.mockGetSession,
    },
  })),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: mocks.mockServiceFrom,
  })),
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
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mocks.mockGetSession.mockResolvedValue({
      data: { session: null },
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
});

describe('getIssuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('returns empty result set', async () => {
    mocks.mockServiceFrom.mockReturnValueOnce(
      createMockChain({
        data: [],
        count: 0,
        error: null,
      }),
    );

    const result = await getIssuesPage({});

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.issues).toEqual([]);
      expect(result.data.total).toBe(0);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    }
  });
});
