import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the webhook retry route.
 *
 * These verify that the retry endpoint dispatches failed events to
 * Inngest using the stored `event_type` rather than a hardcoded value,
 * ensuring events like 'github/installation' or 'github/issues' reach
 * their correct handlers instead of being silently mis-routed to the
 * PR handler.
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
vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
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
  });

  it('dispatches with the stored event_type, not a hardcoded value', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'evt-1',
        event_type: 'github/installation',
        payload: { installation: { id: 42 } },
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
});
