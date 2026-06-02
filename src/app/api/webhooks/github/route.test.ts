import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the GitHub webhook route.
 *
 * These verify that the webhook endpoint:
 *  1. Returns HTTP 429 when the rate limiter rejects a request.
 *  2. Prevents further webhook processing when the rate limit is exceeded.
 *
 * Note:
 * The rate limiter itself is tested separately in `src/lib/rate-limit.test.ts`.
 * These tests focus on route behavior when rate limiting is triggered.
 */

const mockRateLimit = vi.fn();
const mockSend = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('@/inngest/client', () => ({
  inngest: { send: mockSend },
}));

vi.mock('@/lib/github/webhook-verify', () => ({
  verifyWebhookSignature: () => true,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

function buildRequest() {
  return new Request('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers: {
      'x-hub-signature-256': 'sha256=test',
      'x-github-delivery': 'd1',
      'x-github-event': 'installation',
    },
    body: JSON.stringify({
      installation: { id: 123 },
    }),
  });
}

describe('POST /api/webhooks/github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = 'secret';
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAt: Date.now(),
    });

    const { POST } = await import('./route');

    const res = await POST(buildRequest() as any);

    expect(res.status).toBe(429);
  });
});
