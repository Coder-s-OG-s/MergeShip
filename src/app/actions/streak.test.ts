import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentStreak, getPublicStreak } from './streak';

const mocks = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetServiceSupabase: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockRateLimit: vi.fn(),
  mockComputeStreak: vi.fn(),
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

vi.mock('@/lib/xp/streak', () => ({
  computeCurrentStreak: mocks.mockComputeStreak,
}));

/** Build a chainable Supabase query mock with optional terminal result for .single(). */
function makeChain(resolveValue?: unknown) {
  const result = resolveValue ?? { data: null, error: null };
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('getCurrentStreak', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetServerSupabase.mockReturnValue({
      auth: { getUser: mocks.mockGetUser },
    });
    mocks.mockGetServiceSupabase.mockReturnValue({
      from: mocks.mockServiceFrom,
    });
  });

  it('returns current streak for authenticated user', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockComputeStreak.mockReturnValue(5);

    // xp_events query ends with .order() — make it resolve with data.
    const chain = makeChain();
    chain.order = vi.fn().mockResolvedValue({
      data: [{ created_at: '2026-07-09T10:00:00Z' }],
      error: null,
    });
    mocks.mockServiceFrom.mockReturnValue(chain);

    const result = await getCurrentStreak();

    expect(result.days).toBe(5);
    expect(mocks.mockComputeStreak).toHaveBeenCalledWith(
      [{ created_at: '2026-07-09T10:00:00Z' }],
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('returns 0 when user has no activity', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockComputeStreak.mockReturnValue(0);

    const chain = makeChain();
    chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.mockServiceFrom.mockReturnValue(chain);

    const result = await getCurrentStreak();

    expect(result.days).toBe(0);
    expect(mocks.mockComputeStreak).toHaveBeenCalledWith([], expect.any(String));
  });

  it('returns 0 when not authenticated', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getCurrentStreak();

    expect(result.days).toBe(0);
    expect(mocks.mockRateLimit).not.toHaveBeenCalled();
  });

  it('returns 0 when rate limited', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: false });

    const result = await getCurrentStreak();

    expect(result.days).toBe(0);
    expect(mocks.mockComputeStreak).not.toHaveBeenCalled();
  });
});

describe('getPublicStreak', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetServerSupabase.mockReturnValue({
      auth: { getUser: mocks.mockGetUser },
    });
    mocks.mockGetServiceSupabase.mockReturnValue({
      from: mocks.mockServiceFrom,
    });
  });

  it('returns streak for any userId (anonymous)', async () => {
    // Server supabase exists but user not authenticated → key = 'anon:' suffix.
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockComputeStreak.mockReturnValue(3);

    const chain = makeChain();
    chain.order = vi.fn().mockResolvedValue({
      data: [{ created_at: '2026-07-08T10:00:00Z' }],
      error: null,
    });
    mocks.mockServiceFrom.mockReturnValue(chain);

    const result = await getPublicStreak('other-user-id');

    expect(result.days).toBe(3);
    expect(mocks.mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'anon:other-user-id' }),
    );
  });

  it('uses authenticated user key when available', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-id' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockComputeStreak.mockReturnValue(7);

    const chain = makeChain();
    chain.order = vi.fn().mockResolvedValue({
      data: [{ created_at: '2026-07-07T10:00:00Z' }],
      error: null,
    });
    mocks.mockServiceFrom.mockReturnValue(chain);

    const result = await getPublicStreak('other-user-id');

    expect(result.days).toBe(7);
    // When user is authenticated, rate limit key uses user.id, not the anon prefix.
    expect(mocks.mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'auth-user-id' }),
    );
  });
});
