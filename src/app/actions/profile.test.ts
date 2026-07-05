import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for bootstrapProfile — specifically the audit-queuing path.
 *
 * Verifies that:
 *   - When a GitHub App installation exists for the user, audit/run is
 *     fired with installationId and no accessToken field.
 *   - When no installation exists, audit/run is not queued (the install
 *     webhook will fire it with the installationId when the user installs).
 *   - The OAuth provider_token is never included in any Inngest payload.
 */

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSession: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockInngestSend: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({
    auth: {
      getUser: mocks.mockGetUser,
      getSession: mocks.mockGetSession,
    },
  }),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: mocks.mockServiceFrom,
  }),
}));

vi.mock('@/inngest/client', () => ({
  inngest: { send: mocks.mockInngestSend },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { bootstrapProfile } from './profile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chainable Supabase query mock that resolves to `result`. */
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

const BASE_USER = {
  id: 'user-uuid',
  identities: [
    {
      provider: 'github',
      id: 'gh-12345',
      identity_data: { user_name: 'alice', avatar_url: null, name: 'Alice' },
    },
  ],
};

const BASE_PROFILE = {
  id: 'user-uuid',
  github_handle: 'alice',
  audit_completed: false,
  github_stats_synced_at: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bootstrapProfile - audit queuing', () => {
  beforeEach(() => {
    // resetAllMocks clears the mockReturnValueOnce queue in addition to call
    // history, preventing values queued in one test from leaking into the next.
    vi.resetAllMocks();
    mocks.mockGetUser.mockResolvedValue({ data: { user: BASE_USER }, error: null });
    mocks.mockInngestSend.mockResolvedValue(undefined);
  });

  it('queues audit/run with installationId when an active installation exists', async () => {
    mocks.mockServiceFrom
      .mockReturnValueOnce(makeChain({ data: BASE_PROFILE, error: null })) // upsert profiles
      .mockReturnValueOnce(makeChain({ data: { id: 42 }, error: null })) // github_installations
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // maintainer/discover (fire-and-forget)
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // github/stats-sync

    const result = await bootstrapProfile();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.auditQueued).toBe(true);

    type InngestCall = { name: string; data: Record<string, unknown> };
    const auditCall = mocks.mockInngestSend.mock.calls.find(
      (args: unknown[]) => (args[0] as InngestCall)?.name === 'audit/run',
    );
    expect(auditCall).toBeDefined();

    const auditPayload = auditCall?.[0] as InngestCall;

    // Must contain installationId.
    expect(auditPayload.data.installationId).toBe(42);

    // Must NOT transmit an OAuth token through Inngest.
    expect(auditPayload.data).not.toHaveProperty('accessToken');
    expect(JSON.stringify(auditPayload)).not.toContain('provider_token');
  });

  it('does not queue audit/run when no active installation exists', async () => {
    mocks.mockServiceFrom
      .mockReturnValueOnce(makeChain({ data: BASE_PROFILE, error: null })) // upsert profiles
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // github_installations (none)
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // maintainer/discover
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // github/stats-sync

    const result = await bootstrapProfile();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.auditQueued).toBe(false);

    type InngestCall = { name: string; data: Record<string, unknown> };
    const auditCall = mocks.mockInngestSend.mock.calls.find(
      (args: unknown[]) => (args[0] as InngestCall)?.name === 'audit/run',
    );
    expect(auditCall).toBeUndefined();
  });

  it('skips audit/run entirely when audit is already completed', async () => {
    const completedProfile = { ...BASE_PROFILE, audit_completed: true };
    mocks.mockServiceFrom
      .mockReturnValueOnce(makeChain({ data: completedProfile, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // maintainer/discover
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // github/stats-sync

    const result = await bootstrapProfile();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.auditQueued).toBe(false);

    type InngestCall = { name: string; data: Record<string, unknown> };
    const auditCall = mocks.mockInngestSend.mock.calls.find(
      (args: unknown[]) => (args[0] as InngestCall)?.name === 'audit/run',
    );
    expect(auditCall).toBeUndefined();
  });
});
