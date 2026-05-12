import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyWebhookSignature } from './webhook-verify';

function sign(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyWebhookSignature', () => {
  const secret = 'super-secret';
  const body = JSON.stringify({ action: 'opened', pull_request: { id: 1 } });

  it('accepts a valid signature', () => {
    expect(verifyWebhookSignature(body, sign(secret, body), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = sign(secret, body);
    expect(verifyWebhookSignature(body + 'x', sig, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(verifyWebhookSignature(body, sign('other', body), secret)).toBe(false);
  });

  it('rejects missing header', () => {
    expect(verifyWebhookSignature(body, '', secret)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it('rejects malformed header', () => {
    expect(verifyWebhookSignature(body, 'not-sha256', secret)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha256=', secret)).toBe(false);
  });

  it('constant-time compare resists length-mismatch attacks', () => {
    const valid = sign(secret, body);
    expect(verifyWebhookSignature(body, valid.slice(0, 20), secret)).toBe(false);
  });
});
