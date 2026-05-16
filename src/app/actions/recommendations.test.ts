import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    mockGetUser: vi.fn(),
    mockServiceFrom: vi.fn(),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
    mockCacheDel: vi.fn(),
    mockRateLimit: vi.fn(),
    mockTryGetDb: vi.fn(),
    mockSql: vi.fn((strings, ...values) => ({ strings, values })),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    auth: { getUser: mocks.mockGetUser },
  })),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: mocks.mockServiceFrom,
  })),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: mocks.mockCacheGet,
  cacheSet: mocks.mockCacheSet,
  cacheDel: mocks.mockCacheDel,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.mockRateLimit,
}));

vi.mock('@/lib/db/client', () => ({
  tryGetDb: mocks.mockTryGetDb,
  schema: {
    recommendations: {
      id: 'r.id',
      issueId: 'r.issueId',
      difficulty: 'r.diff',
      xpReward: 'r.xp',
      status: 'r.status',
      userId: 'r.userId',
      recommendedAt: 'r.recAt',
    },
    issues: {
      id: 'i.id',
      repoFullName: 'i.repo',
      githubIssueNumber: 'i.num',
      title: 'i.title',
      url: 'i.url',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: mocks.mockSql,
}));

import {
  getRecommendations,
  claimRecommendation,
  skipRecommendation,
  linkPrToRec,
  unlinkPrFromRec,
  unclaimRecommendation,
} from './recommendations';

const mockDbLimit = vi.fn();
const mockDbOrderBy = vi.fn(() => ({ limit: mockDbLimit }));
const mockDbWhere = vi.fn(() => ({ orderBy: mockDbOrderBy }));
const mockDbInnerJoin = vi.fn(() => ({ where: mockDbWhere }));
const mockDbFrom = vi.fn(() => ({ innerJoin: mockDbInnerJoin }));
const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));

const mockDb = { select: mockDbSelect };

const createMockChain = (chainResult: any, singleResult: any = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(singleResult)),
    then: function (resolve: any, reject: any) {
      if (chainResult instanceof Error) {
        return Promise.reject(chainResult).catch(reject);
      }
      return Promise.resolve(chainResult).then(resolve);
    },
  };
  return chain;
};

describe('Recommendations Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } } });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockServiceFrom.mockImplementation(() => createMockChain(null, null));
  });

  describe('getRecommendations', () => {
    it('returns cached result when cache is warm', async () => {
      const cached = [{ id: 1, title: 'Cached Rec' }];
      mocks.mockCacheGet.mockResolvedValueOnce(cached);

      const result = await getRecommendations();
      
      expect(result).toEqual({ ok: true, data: cached });
      expect(mocks.mockCacheGet).toHaveBeenCalledWith('recs:test-user-id');
      expect(mocks.mockTryGetDb).not.toHaveBeenCalled();
    });

    it('queries DB and caches when cache is cold', async () => {
      mocks.mockCacheGet.mockResolvedValueOnce(null);
      mocks.mockTryGetDb.mockReturnValueOnce(mockDb);
      
      const dbRows = [
        {
          id: 1,
          issueId: 10,
          difficulty: 'E',
          xpReward: 100,
          status: 'open',
          repoFullName: 'test/repo',
          issueNumber: 42,
          title: 'Fix issue',
          url: 'https://github.com/test/repo/issues/42',
        },
      ];
      mockDbLimit.mockResolvedValueOnce(dbRows);

      const result = await getRecommendations();
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('Fix issue');
      }
      expect(mocks.mockCacheSet).toHaveBeenCalledWith(
        'recs:test-user-id',
        expect.any(Array),
        60 * 60
      );
    });

    it('returns empty array when DB is not configured', async () => {
      mocks.mockCacheGet.mockResolvedValueOnce(null);
      mocks.mockTryGetDb.mockReturnValueOnce(null);

      const result = await getRecommendations();
      
      expect(result).toEqual({ ok: true, data: [] });
    });
  });

  describe('claimRecommendation', () => {
    it('updates status to claimed and sets claimed_at, invalidating cache', async () => {
      mocks.mockServiceFrom
        .mockReturnValueOnce(createMockChain({ count: 0 })) // count claims
        .mockReturnValueOnce(createMockChain(null, { data: { id: 1 }, error: null })) // update
        .mockReturnValueOnce(createMockChain({})); // insert activity_log

      const result = await claimRecommendation(1);
      
      expect(result).toEqual({ ok: true, data: { id: 1 } });
      expect(mocks.mockCacheDel).toHaveBeenCalledWith('recs:test-user-id');
    });

    it('returns already_claimed error if status is not open', async () => {
      mocks.mockServiceFrom
        .mockReturnValueOnce(createMockChain({ count: 0 })) // count claims
        .mockReturnValueOnce(createMockChain(null, { data: null, error: null })); // update returns null row

      const result = await claimRecommendation(1);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('already_claimed');
      }
    });
    
    it('returns claim_limit error if user has 3 or more claims', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain({ count: 3 })); // count claims

      const result = await claimRecommendation(1);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('claim_limit');
      }
    });
  });

  describe('skipRecommendation', () => {
    it('sets status to reassigned and returns a replacement rec', async () => {
      mocks.mockServiceFrom
        .mockReturnValueOnce(createMockChain(null, { data: { id: 1, difficulty: 'E', issue_id: 10 }, error: null })) // update rec
        .mockReturnValueOnce(createMockChain({ data: [{ issue_id: 10 }] })) // select seen
        .mockReturnValueOnce(createMockChain({ 
          data: [{ id: 11, difficulty: 'E', xp_reward: 100, repo_full_name: 'a/b', github_issue_number: 2, title: 'T', url: 'http' }] 
        })) // select pool
        .mockReturnValueOnce(createMockChain(null, { data: { id: 2 }, error: null })); // insert replacement

      const result = await skipRecommendation(1);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe(1);
        expect(result.data.replacement?.id).toBe(2);
      }
      expect(mocks.mockCacheDel).toHaveBeenCalledWith('recs:test-user-id');
    });

    it('returns null replacement when pool is exhausted', async () => {
      mocks.mockServiceFrom
        .mockReturnValueOnce(createMockChain(null, { data: { id: 1, difficulty: 'E', issue_id: 10 }, error: null })) // update rec
        .mockReturnValueOnce(createMockChain({ data: [{ issue_id: 10 }] })) // select seen
        .mockReturnValueOnce(createMockChain({ data: [] })) // select pool E
        .mockReturnValueOnce(createMockChain({ data: [] })); // select pool Any

      const result = await skipRecommendation(1);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe(1);
        expect(result.data.replacement).toBeNull();
      }
    });

    it('returns not_skippable if status is not open', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain(null, { data: null, error: null })); // update returns null row

      const result = await skipRecommendation(1);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('not_skippable');
      }
    });
  });

  describe('linkPrToRec', () => {
    it('updates linked_pr_url when URL is valid', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain(null, { data: { id: 1 }, error: null }));

      const result = await linkPrToRec(1, 'https://github.com/owner/repo/pull/123');
      
      expect(result).toEqual({ ok: true, data: { id: 1 } });
      expect(mocks.mockCacheDel).toHaveBeenCalledWith('recs:test-user-id');
    });

    it('returns invalid_url for non-GitHub URLs', async () => {
      const result = await linkPrToRec(1, 'https://gitlab.com/owner/repo/pull/123');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('invalid_url');
      }
    });

    it('returns not_linkable when rec is not open/claimed', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain(null, { data: null, error: null }));

      const result = await linkPrToRec(1, 'https://github.com/owner/repo/pull/123');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('not_linkable');
      }
    });
  });

  describe('unlinkPrFromRec', () => {
    it('clears linked_pr_url', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain(null, { data: { id: 1 }, error: null }));

      const result = await unlinkPrFromRec(1);
      
      expect(result).toEqual({ ok: true, data: { id: 1 } });
      expect(mocks.mockCacheDel).toHaveBeenCalledWith('recs:test-user-id');
    });
  });

  describe('unclaimRecommendation', () => {
    it('resets status to open and clears claimed_at and linked_pr_url', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain(null, { data: { id: 1 }, error: null }));

      const result = await unclaimRecommendation(1);
      
      expect(result).toEqual({ ok: true, data: { id: 1 } });
      expect(mocks.mockCacheDel).toHaveBeenCalledWith('recs:test-user-id');
    });

    it('returns not_claimable if rec is not in claimed state', async () => {
      mocks.mockServiceFrom.mockReturnValueOnce(createMockChain(null, { data: null, error: null }));

      const result = await unclaimRecommendation(1);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('not_claimable');
      }
    });
  });
});
