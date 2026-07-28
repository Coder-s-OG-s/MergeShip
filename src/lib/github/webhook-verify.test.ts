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

describe('verifyWebhookSignature with multiple secrets', () => {
  const secret1 = 'old-secret';
  const secret2 = 'new-secret';
  const secret3 = 'future-secret';
  const body = JSON.stringify({ action: 'opened' });
  const secrets = [secret1, secret2];

  it('accepts signature matching the first secret', () => {
    expect(verifyWebhookSignature(body, sign(secret1, body), secrets)).toBe(true);
  });

  it('accepts signature matching the second secret', () => {
    expect(verifyWebhookSignature(body, sign(secret2, body), secrets)).toBe(true);
  });

  it('rejects signature matching neither secret', () => {
    expect(verifyWebhookSignature(body, sign(secret3, body), secrets)).toBe(false);
  });

  it('rejects tampered body for all secrets', () => {
    expect(verifyWebhookSignature(body + 'x', sign(secret1, body), secrets)).toBe(false);
    expect(verifyWebhookSignature(body + 'x', sign(secret2, body), secrets)).toBe(false);
  });
});
