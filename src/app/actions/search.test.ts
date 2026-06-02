import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    mockGetUser: vi.fn(),
    mockRateLimit: vi.fn(),
    mockGetDb: vi.fn(),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    auth: { getUser: mocks.mockGetUser },
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.mockRateLimit,
}));

const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockDb = { select: mockSelect };

vi.mock('@/lib/db/client', () => ({
  getDb: mocks.mockGetDb,
}));

vi.mock('@/lib/db/schema', () => ({
  issues: {
    id: 'i.id',
    title: 'i.title',
    repoFullName: 'i.repoFullName',
    url: 'i.url',
  },
  profiles: {
    githubHandle: 'p.githubHandle',
    displayName: 'p.displayName',
    avatarUrl: 'p.avatarUrl',
    level: 'p.level',
  },
}));

vi.mock('drizzle-orm', () => ({
  ilike: vi.fn((col, pat) => ({ col, pat })),
  desc: vi.fn((col) => ({ col, dir: 'desc' })),
}));

import { searchGlobal } from './search';
import { getServerSupabase } from '@/lib/supabase/server';

describe('searchGlobal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } } });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockGetDb.mockReturnValue(mockDb);
  });

  it('returns unauthorized when user is not signed in', async () => {
    mocks.mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await searchGlobal('test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('returns no_supabase when supabase is not available', async () => {
    vi.mocked(getServerSupabase).mockReturnValueOnce(
      null as unknown as ReturnType<typeof getServerSupabase>,
    );
    const result = await searchGlobal('test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('no_supabase');
  });

  it('returns rate_limited when limit is exceeded', async () => {
    mocks.mockRateLimit.mockResolvedValueOnce({ ok: false });
    const result = await searchGlobal('test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('rate_limited');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns empty results for queries shorter than 2 characters', async () => {
    const result = await searchGlobal('a');
    expect(result).toEqual({ ok: true, data: { issues: [], profiles: [] } });
  });

  it('returns empty results for whitespace-only queries', async () => {
    const result = await searchGlobal('   ');
    expect(result).toEqual({ ok: true, data: { issues: [], profiles: [] } });
  });

  it('returns matched issues and profiles for valid query', async () => {
    const issueRows = [
      {
        id: 1,
        title: 'Fix bug in parser',
        repoFullName: 'org/repo',
        url: 'https://github.com/org/repo/issues/1',
      },
    ];
    const profileRows = [
      {
        githubHandle: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://avatar.url',
        level: 3,
      },
    ];

    // First mockLimit call = issues, second = profiles
    mockLimit.mockResolvedValueOnce(issueRows).mockResolvedValueOnce(profileRows);

    const result = await searchGlobal('test');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.issues).toEqual(issueRows);
      expect(result.data.profiles).toEqual(profileRows);
    }
  });

  it('returns empty results when no matches found', async () => {
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await searchGlobal('zzzznonexistent');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.issues).toEqual([]);
      expect(result.data.profiles).toEqual([]);
    }
  });

  it('returns search_failed on database error', async () => {
    mockLimit.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await searchGlobal('test');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('search_failed');
  });

  it('calls rate limit with correct namespace and key', async () => {
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await searchGlobal('test');

    expect(mocks.mockRateLimit).toHaveBeenCalledWith({
      namespace: 'search',
      key: 'test-user',
      limit: 30,
      windowSec: 60,
    });
  });
});
