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

vi.mock('@/lib/maintainer/detect', () => ({
  isUserMaintainer: () => true,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/webhooks/github/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
});
