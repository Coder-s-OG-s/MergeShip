import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendHelpRequest } from './help';

const mocks = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetServiceSupabase: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockInngestSend: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: mocks.mockGetServerSupabase,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: mocks.mockGetServiceSupabase,
}));

vi.mock('@/inngest/client', () => ({
  inngest: { send: mocks.mockInngestSend },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.mockRateLimit,
  RATE_LIMIT_TIERS: { HOURLY: { limit: 5, windowSec: 3600 } },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Build a chainable Supabase query mock with optional terminal result for .single(). */
function makeChain(resolveValue?: unknown) {
  const result = resolveValue ?? { data: null, error: null };
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('sendHelpRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetServerSupabase.mockReturnValue({
      auth: { getUser: mocks.mockGetUser },
    });
    mocks.mockGetServiceSupabase.mockReturnValue({
      from: mocks.mockServiceFrom,
    });
  });

  it('rejects when server supabase not configured', async () => {
    mocks.mockGetServerSupabase.mockReturnValue(null);

    const result = await sendHelpRequest({ recId: 1, prUrl: 'help' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_configured');
  });

  it('rejects when user not authenticated', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await sendHelpRequest({ recId: 1, prUrl: 'help' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_authenticated');
  });

  it('rejects when rate limited', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({
      ok: false,
      resetAt: new Date('2026-07-10T12:00:00Z'),
    });

    const result = await sendHelpRequest({ recId: 1, prUrl: 'help' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('rate_limited');
      expect(result.error.resetAt).toBeDefined();
    }
  });

  it('enforces cooldown for same PR URL within 4 hours', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    // Cooldown query: .limit() returns existing help request → cooldown hit
    const cooldownChain = makeChain();
    cooldownChain.limit = vi.fn().mockResolvedValue({ data: [{ id: 99 }], error: null });
    mocks.mockServiceFrom.mockReturnValueOnce(cooldownChain);

    const result = await sendHelpRequest({
      recId: 1,
      prUrl: 'https://github.com/user/repo/pull/42',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cooldown');
  });

  it('accepts plain text message and sends help request', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockInngestSend.mockResolvedValue(undefined);

    // Cooldown query: standard chain → .limit() returns chain → data is
    // undefined → cooldown passes.
    const cooldownChain = makeChain();
    mocks.mockServiceFrom.mockReturnValueOnce(cooldownChain);

    // Insert query: .single() resolves with the new row.
    const insertChain = makeChain({ data: { id: 123 }, error: null });
    mocks.mockServiceFrom.mockReturnValueOnce(insertChain);

    const result = await sendHelpRequest({ recId: 1, prUrl: 'I need help' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.helpRequestId).toBe(123);

    expect(mocks.mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'help/dispatch' }),
    );
  });

  it('accepts valid GitHub PR URL', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });
    mocks.mockInngestSend.mockResolvedValue(undefined);

    const cooldownChain = makeChain();
    mocks.mockServiceFrom.mockReturnValueOnce(cooldownChain);

    const insertChain = makeChain({ data: { id: 456 }, error: null });
    mocks.mockServiceFrom.mockReturnValueOnce(insertChain);

    const prUrl = 'https://github.com/some-org/some-repo/pull/789';
    const result = await sendHelpRequest({ recId: 1, prUrl });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.helpRequestId).toBe(456);

    // Inngest payload must include the prUrl for valid GitHub URLs.
    expect(mocks.mockInngestSend).toHaveBeenCalledWith({
      name: 'help/dispatch',
      data: { helpRequestId: 456, userId: 'user-1', prUrl },
    });
  });
});
