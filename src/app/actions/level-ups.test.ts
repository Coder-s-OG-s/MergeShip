import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnacknowledgedLevelUps, acknowledgeLevelUp } from './level-ups';

const mocks = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockGetServiceSupabase: vi.fn(),
  mockGetUser: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: mocks.mockGetServerSupabase,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: mocks.mockGetServiceSupabase,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.mockRateLimit,
}));

function makeServiceChain(resolveValue?: any, resolveError?: any) {
  const result = { data: resolveValue, error: resolveError };
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  // update().eq().eq() typically resolves directly without .limit()
  // We can attach a then() method to make the mock itself thenable
  // when returning from eq().
  (chain.eq as any).mockImplementation(() => {
    // If we've reached the end of an update chain, make it thenable
    return {
      ...chain,
      eq: chain.eq,
      then: (resolve: (v: any) => void) => resolve(result),
    };
  });
  return chain;
}

describe('level-ups actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetServerSupabase.mockReturnValue({
      auth: { getUser: mocks.mockGetUser },
    });
  });

  describe('getUnacknowledgedLevelUps', () => {
    it('returns not_configured if supabase is not available', async () => {
      mocks.mockGetServerSupabase.mockReturnValue(null);
      const res = await getUnacknowledgedLevelUps();
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_configured');
    });

    it('returns unauthenticated if user is not signed in', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await getUnacknowledgedLevelUps();
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authenticated');
    });

    it('returns not_configured if service role is missing', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      mocks.mockGetServiceSupabase.mockReturnValue(null);
      const res = await getUnacknowledgedLevelUps();
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_configured');
    });

    it('returns empty array if no data is found (graceful fallback)', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

      const mockChain = makeServiceChain(null);
      mocks.mockGetServiceSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue(mockChain),
      });

      const res = await getUnacknowledgedLevelUps();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual([]);
      }
    });

    it('fetches and maps unacknowledged level ups', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

      const mockChain = makeServiceChain([
        { id: 10, from_level: 2, to_level: 3, occurred_at: '2026-08-01T00:00:00Z' },
      ]);
      mocks.mockGetServiceSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue(mockChain),
      });

      const res = await getUnacknowledgedLevelUps();

      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(mockChain.eq).toHaveBeenCalledWith('acknowledged', false);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0]).toEqual({
          id: 10,
          fromLevel: 2,
          toLevel: 3,
          occurredAt: '2026-08-01T00:00:00Z',
        });
      }
    });
  });

  describe('acknowledgeLevelUp', () => {
    it('returns not_configured if supabase is not available', async () => {
      mocks.mockGetServerSupabase.mockReturnValue(null);
      const res = await acknowledgeLevelUp(10);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_configured');
    });

    it('returns unauthenticated if user is not signed in', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await acknowledgeLevelUp(10);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authenticated');
    });

    it('returns rate_limited if rate limit is exceeded', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      mocks.mockRateLimit.mockResolvedValue({ ok: false });
      const res = await acknowledgeLevelUp(10);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns not_configured if service role is missing', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      mocks.mockRateLimit.mockResolvedValue({ ok: true });
      mocks.mockGetServiceSupabase.mockReturnValue(null);
      const res = await acknowledgeLevelUp(10);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_configured');
    });

    it('returns persist_failed if database update fails', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      mocks.mockRateLimit.mockResolvedValue({ ok: true });

      const mockChain = makeServiceChain(null, new Error('db crashed'));
      mocks.mockGetServiceSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue(mockChain),
      });

      const res = await acknowledgeLevelUp(10);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('persist_failed');
        expect(res.error.message).toBe('db crashed');
      }
    });

    it('successfully updates acknowledged flag', async () => {
      mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      mocks.mockRateLimit.mockResolvedValue({ ok: true });

      const mockChain = makeServiceChain(null, null); // no error
      mocks.mockGetServiceSupabase.mockReturnValue({
        from: vi.fn().mockReturnValue(mockChain),
      });

      const res = await acknowledgeLevelUp(10);

      expect(mocks.mockRateLimit).toHaveBeenCalledWith({
        namespace: 'level-ups:acknowledge',
        key: 'u1',
        limit: 30,
        windowSec: 60,
      });

      expect(mockChain.update).toHaveBeenCalledWith({ acknowledged: true });
      expect(mockChain.eq).toHaveBeenCalledWith('id', 10);
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ ok: true });
      }
    });
  });
});
