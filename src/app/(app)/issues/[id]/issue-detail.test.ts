import { describe, expect, it, vi, beforeEach } from 'vitest';
import { slugify } from '@/app/actions/issues';

describe('slugify', () => {
  it('converts a simple title to a slug', () => {
    expect(slugify('Fix cleanup goroutine leak')).toBe('fix-cleanup-goroutine-leak');
  });

  it('strips special characters', () => {
    expect(slugify('[Bug] Context cancel: not handled!')).toBe('bug-context-cancel-not-handled');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('---Hello World---')).toBe('hello-world');
  });

  it('truncates to 40 characters', () => {
    const long = 'a'.repeat(60);
    expect(slugify(long).length).toBeLessThanOrEqual(40);
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('collapses multiple separators into one dash', () => {
    expect(slugify('fix   multiple   spaces')).toBe('fix-multiple-spaces');
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

import { getIssueById } from '@/app/actions/issues';

const createMockChain = (result: unknown) => {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return chain;
};

describe('getIssueById', () => {
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

  it('returns issue detail with full fields', async () => {
    let callCount = 0;
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'issues') {
        return createMockChain({
          data: {
            id: 42,
            repo_full_name: 'org/repo',
            github_issue_number: 100,
            title: 'Fix leak',
            difficulty: 'E',
            xp_reward: 120,
            labels: ['bug'],
            state: 'open',
            url: 'https://github.com/org/repo/issues/100',
            fetched_at: '2026-07-18T00:00:00Z',
            body_excerpt: '## Description\nSomething broken',
            author_login: 'alex',
            assignee_login: null,
            comments_count: 3,
            github_created_at: '2026-07-17T00:00:00Z',
            summary: 'Fix the goroutine leak',
          },
          error: null,
        });
      }
      if (table === 'recommendations') {
        return createMockChain({
          data: { id: 10, status: 'claimed' },
        });
      }
      return createMockChain({ data: [] });
    });

    const result = await getIssueById(42);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(42);
      expect(result.data.title).toBe('Fix leak');
      expect(result.data.bodyExcerpt).toBe('## Description\nSomething broken');
      expect(result.data.authorLogin).toBe('alex');
      expect(result.data.commentsCount).toBe(3);
      expect(result.data.userRecId).toBe(10);
      expect(result.data.userRecStatus).toBe('claimed');
    }
  });

  it('returns not_found for nonexistent issue', async () => {
    mocks.mockServiceFrom.mockImplementation(() => {
      return createMockChain({
        data: null,
        error: { message: 'not found', code: 'PGRST116' },
      });
    });

    const result = await getIssueById(99999);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('not_found');
    }
  });

  it('returns null rec fields when user has no recommendation', async () => {
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'issues') {
        return createMockChain({
          data: {
            id: 43,
            repo_full_name: 'org/repo',
            github_issue_number: 101,
            title: 'New feature',
            difficulty: 'M',
            xp_reward: 200,
            labels: [],
            state: 'open',
            url: 'https://github.com/org/repo/issues/101',
            fetched_at: '2026-07-18T00:00:00Z',
            body_excerpt: null,
            author_login: 'bob',
            assignee_login: null,
            comments_count: 0,
            github_created_at: '2026-07-18T00:00:00Z',
            summary: null,
          },
          error: null,
        });
      }
      if (table === 'recommendations') {
        return createMockChain({ data: null });
      }
      return createMockChain({ data: [] });
    });

    const result = await getIssueById(43);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userRecId).toBeNull();
      expect(result.data.userRecStatus).toBeNull();
      expect(result.data.bodyExcerpt).toBeNull();
    }
  });
});
