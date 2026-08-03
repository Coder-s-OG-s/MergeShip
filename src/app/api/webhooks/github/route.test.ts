import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the GitHub webhook route.
 *
 * These verify that the webhook endpoint:
 *  1. Returns HTTP 429 when the rate limiter rejects a request.
 *  2. Ignores unhandled event types before rate limiting or persisting.
 *  3. Never returns 5xx for a signature-verified delivery: transient DB and
 *     send failures degrade to 2xx + best-effort dispatch / dead-letter row.
 *  4. Splits rate-limit buckets per installation + event type.
 *
 * Note:
 * The rate limiter itself is tested separately in `src/lib/rate-limit.test.ts`.
 */

const { mockRateLimit, mockSend, mockInsert, mockFailedInsert } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockSend: vi.fn(),
  mockInsert: vi.fn().mockResolvedValue({ error: null }),
  mockFailedInsert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    rateLimit: mockRateLimit,
  };
});

vi.mock('@/inngest/client', () => ({
  inngest: { send: mockSend },
}));

vi.mock('@/lib/github/webhook-verify', () => ({
  verifyWebhookSignature: () => true,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: (table: string) =>
      table === 'failed_webhook_events' ? { insert: mockFailedInsert } : { insert: mockInsert },
  }),
}));

function buildRequest({
  delivery = 'd1',
  event = 'installation',
  body = { installation: { id: 123 } },
}: {
  delivery?: string;
  event?: string;
  body?: Record<string, unknown>;
} = {}) {
  return new Request('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers: {
      'x-hub-signature-256': 'sha256=test',
      'x-github-delivery': delivery,
      'x-github-event': event,
    },
    body: JSON.stringify(body),
  });
}

import { POST } from './route';

describe('POST /api/webhooks/github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = 'secret';
    mockInsert.mockResolvedValue({ error: null });
    mockFailedInsert.mockResolvedValue({ error: null });
    mockSend.mockResolvedValue(undefined);
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 99, resetAt: Date.now() });
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAt: Date.now(),
    });

    const res = await POST(buildRequest() as any);

    expect(res.status).toBe(429);
  });

  it('rate limits per installation + event type so noise cannot starve real events', async () => {
    await POST(buildRequest() as any);

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'webhook',
        key: 'install:123:installation',
      }),
    );
  });

  it('falls back to a global rate limit bucket for handled events without an installation ID', async () => {
    const req = buildRequest({
      event: 'pull_request',
      body: { action: 'opened', pull_request: {} },
    });

    await POST(req as any);

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global:pull_request',
      }),
    );
  });

  it('acknowledges unhandled event types without rate limiting or persisting', async () => {
    const req = buildRequest({ event: 'push', body: { ref: 'refs/heads/main' } });

    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('still dispatches on a transient webhook_deliveries insert failure (no 500)', async () => {
    mockInsert.mockResolvedValue({ error: { code: 'PGRST116', message: 'db down' } });
    mockSend.mockResolvedValue(undefined);

    const res = await POST(buildRequest() as any);

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ name: 'github/installation' }));
  });

  it('persists a dead-letter row and returns 2xx when inngest.send fails', async () => {
    mockSend.mockRejectedValue(new Error('inngest down'));

    const res = await POST(buildRequest() as any);

    expect(res.status).toBe(202);
    expect(mockFailedInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: 'd1',
        event_type: 'github/installation',
        source: 'webhook/route',
        installation_id: 123,
      }),
    );
  });

  it('replays a duplicate delivery and still dispatches', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });
    mockSend.mockResolvedValue(undefined);

    const res = await POST(buildRequest() as any);

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ name: 'github/installation' }));
  });
});
