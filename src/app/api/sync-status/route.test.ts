import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: mockEq,
      }),
    }),
  }),
}));

function buildRequest(url = 'http://localhost/api/sync-status'): Request {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/sync-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({
      data: { github_stats_synced_at: '2026-06-01T00:00:00Z' },
      error: null,
    });
  });

  it('uses the authenticated user id instead of the query string userId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'session-user' } } });

    const { GET } = await import('./route');
    const res = await GET(buildRequest('http://localhost/api/sync-status?userId=other-user'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('completed');
    expect(mockEq).toHaveBeenCalledWith('id', 'session-user');
    expect(mockEq).not.toHaveBeenCalledWith('id', 'other-user');
  });

  it('rejects unauthenticated requests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import('./route');
    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(mockEq).not.toHaveBeenCalled();
  });
});
