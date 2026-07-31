import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

vi.mock('@/app/actions/profile', () => ({
  bootstrapProfile: vi.fn().mockResolvedValue(undefined),
}));

function buildRequest(next?: string): NextRequest {
  const qs = next ? `?code=abc&next=${encodeURIComponent(next)}` : '?code=abc';
  return new NextRequest(`http://localhost/api/auth/callback${qs}`);
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it('redirects to a safe next param', async () => {
    const { GET } = await import('./route');
    const res = await GET(buildRequest('/settings'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/settings');
  });

  it('falls back to /dashboard for an absolute URL next param', async () => {
    const { GET } = await import('./route');
    const res = await GET(buildRequest('https://evil.com/phishing'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('falls back to /dashboard for a protocol-relative next param', async () => {
    const { GET } = await import('./route');
    const res = await GET(buildRequest('//evil.com/phishing'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });
});
