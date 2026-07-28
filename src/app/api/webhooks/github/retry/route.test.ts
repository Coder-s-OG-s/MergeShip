import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the webhook retry route.
 *
 * These verify that the retry endpoint:
 *  1. Dispatches failed events using the stored `event_type` (not hardcoded).
 *  2. Increments `retry_count` on each retry attempt.
 *  3. Enforces a retry ceiling (MAX_RETRIES = 5) to prevent infinite loops.
 *  4. Deletes the dead-letter row after a successful dispatch.
 *  5. Rejects events with invalid `event_type` values (422).
 *  6. Returns 404 for non-existent events.
 *
 * @see https://github.com/Coder-s-OG-s/MergeShip/issues/143
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    rateLimit: mockRateLimit,
  };
});

const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/inngest/client', () => ({ inngest: { send: mockSend } }));

const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({ auth: { getUser: mockGetUser } }),
}));

const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
      update: mockUpdate,
      delete: mockDelete,
    }),
  }),
}));

const mockListInstalls = vi.fn();
vi.mock('@/lib/maintainer/detect', () => ({
  isUserMaintainer: () => true,
  listMaintainerInstalls: (...args: unknown[]) => mockListInstalls(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: Record<string, unknown>, origin?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers['origin'] = origin;
  return new Request('http://localhost/api/webhooks/github/retry', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/github/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 9, resetAt: Date.now() + 60000 });
    mockListInstalls.mockResolvedValue([
      {
        installationId: 42,
        accountLogin: 'org-a',
        accountType: 'Organization',
        permissionLevel: 'org_admin',
      },
    ]);
  });

  it('dispatches with the stored event_type, not a hardcoded value', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-1',
        event_type: 'github/installation',
        payload: { installation: { id: 42 } },
        retry_count: 0,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.event_type).toBe('github/installation');

    expect(mockSend).toHaveBeenCalledWith({
      name: 'github/installation',
      data: { installation: { id: 42 } },
    });
  });

  it('still works for pull_request events (regression guard)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-2',
        event_type: 'github/pull_request',
        payload: { pull_request: { number: 7 } },
        retry_count: 0,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-2' }));

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith({
      name: 'github/pull_request',
      data: { pull_request: { number: 7 } },
    });
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60000 });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-1' }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('too many requests');
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects events with an invalid event_type (422)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-3',
        event_type: 'bad-type',
        payload: {},
        retry_count: 0,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-3' }));
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe('invalid event_type');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 404 when the failed event does not exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'missing' }));

    expect(res.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('increments retry_count before dispatching', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-4',
        event_type: 'github/issues',
        payload: { issue: { number: 5 } },
        retry_count: 2,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-4' }));

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ retry_count: 3 });
  });

  it('rejects retries that exceed MAX_RETRIES (409)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-5',
        event_type: 'github/issues',
        payload: { issue: { number: 10 } },
        retry_count: 5,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-5' }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('max retries exceeded');
    expect(json.retry_count).toBe(5);
    expect(json.max).toBe(5);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('deletes the dead-letter row after successful dispatch', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-6',
        event_type: 'github/pull_request',
        payload: { pull_request: { number: 99 } },
        retry_count: 0,
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest({ id: 'evt-6' }));

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  describe('CSRF protection', () => {
    it('rejects requests from foreign origins (Origin mismatch)', async () => {
      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-1' }, 'https://evil.com'));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('rejects requests with malformed Origin header', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        new Request('http://localhost/api/webhooks/github/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', origin: ':::' },
          body: JSON.stringify({ id: 'evt-1' }),
        }),
      );

      expect(res.status).toBe(403);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('allows same-origin requests from the configured app URL', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: 'evt-7', event_type: 'github/push', payload: {}, retry_count: 0 },
      });

      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-7' }, 'http://localhost:3001'));

      expect(res.status).toBe(200);
      expect(mockSend).toHaveBeenCalled();
    });

    it('rejects requests without Origin in production (NODE_ENV=production)', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const onError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-1' }));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
      expect(mockSend).not.toHaveBeenCalled();

      onError.mockRestore();
      vi.unstubAllEnvs();
    });

    it('allows matching-origin requests in production when NEXT_PUBLIC_APP_URL is set', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mergeship.example.com');

      mockMaybeSingle.mockResolvedValue({
        data: { id: 'evt-11', event_type: 'github/push', payload: {}, retry_count: 0 },
      });

      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-11' }, 'https://mergeship.example.com'));

      expect(res.status).toBe(200);
      expect(mockSend).toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });

  describe('installation access control', () => {
    it('rejects retry when maintainer lacks access to the event installation', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'evt-8',
          event_type: 'github/push',
          payload: { installation: { id: 999 } },
          retry_count: 0,
        },
      });

      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-8' }));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('allows retry when maintainer has access to the event installation', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'evt-9',
          event_type: 'github/push',
          payload: { installation: { id: 42 } },
          retry_count: 0,
        },
      });

      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-9' }));

      expect(res.status).toBe(200);
      expect(mockSend).toHaveBeenCalled();
    });

    it('allows retry for events without an installation id (global events)', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'evt-10',
          event_type: 'github/meta',
          payload: {},
          retry_count: 0,
        },
      });

      const { POST } = await import('./route');
      const res = await POST(buildRequest({ id: 'evt-10' }));

      expect(res.status).toBe(200);
      expect(mockSend).toHaveBeenCalled();
    });
  });
});
