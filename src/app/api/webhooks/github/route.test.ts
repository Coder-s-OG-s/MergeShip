import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Unit tests for the GitHub webhook receiver.
 *
 * Key coverage:
 *   - Non-duplicate INSERT failures return a generic 500 with no internal
 *     database fields (code, details, hint, raw message) in the body.
 *   - Duplicate delivery UUIDs (23505) resolve as 200 with duplicate=true.
 *   - Signature verification rejects tampered payloads (401).
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@/inngest/client', () => ({ inngest: { send: mockSend } }));

const mockInsert = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

vi.mock('@/lib/github/webhook-verify', () => ({
  verifyWebhookSignature: (_body: string, sig: string | null, _secret: string) =>
    sig === 'valid-sig',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-secret';
const DELIVERY_ID = 'delivery-uuid-123';
const EVENT_TYPE = 'pull_request';
const PAYLOAD = JSON.stringify({ action: 'opened' });

function buildRequest(
  overrides: {
    signature?: string | null;
    deliveryId?: string | null;
    eventType?: string | null;
    body?: string;
  } = {},
): Request {
  const {
    signature = 'valid-sig',
    deliveryId = DELIVERY_ID,
    eventType = EVENT_TYPE,
    body = PAYLOAD,
  } = overrides;

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (signature !== null) headers.set('x-hub-signature-256', signature);
  if (deliveryId !== null) headers.set('x-github-delivery', deliveryId);
  if (eventType !== null) headers.set('x-github-event', eventType);

  return new Request('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers,
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', WEBHOOK_SECRET);
    mockInsert.mockResolvedValue({ error: null });
    mockSend.mockResolvedValue(undefined);
  });

  it('returns 200 ok=true for a valid new delivery', async () => {
    const { POST } = await import('./route');
    const res = await POST(buildRequest() as Parameters<typeof POST>[0]);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(false);
  });

  it('returns 401 when signature is invalid', async () => {
    const { POST } = await import('./route');
    const res = await POST(buildRequest({ signature: 'bad-sig' }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it('returns 400 when required headers are missing', async () => {
    const { POST } = await import('./route');
    const res = await POST(buildRequest({ deliveryId: null }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it('returns 200 with duplicate=true for a 23505 unique-constraint error', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505' } });
    const { POST } = await import('./route');
    const res = await POST(buildRequest() as Parameters<typeof POST>[0]);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(json.ok).toBe(true);
  });

  it('returns generic 500 without leaking Supabase error fields on non-duplicate INSERT failure', async () => {
    mockInsert.mockResolvedValue({
      error: {
        code: '42P01',
        message: 'relation "webhook_deliveries" does not exist',
        details: 'Some internal details',
        hint: 'Run the migration',
      },
    });

    const { POST } = await import('./route');
    const res = await POST(buildRequest() as Parameters<typeof POST>[0]);
    const json = await res.json();

    expect(res.status).toBe(500);

    // The body must not expose internal database fields.
    expect(json).not.toHaveProperty('code');
    expect(json).not.toHaveProperty('details');
    expect(json).not.toHaveProperty('hint');
    expect(json.error).toBe('internal error');

    // The raw Postgres message must not appear in the body.
    expect(JSON.stringify(json)).not.toContain('relation "webhook_deliveries"');
  });
});
