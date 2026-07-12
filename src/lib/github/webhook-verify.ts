import crypto from 'node:crypto';

/**
 * Verify GitHub webhook HMAC. Always use timingSafeEqual to defend against
 * timing-based signature recovery.
 *
 * Header format: "sha256=<hex>"
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | string[],
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice('sha256='.length);
  if (provided.length === 0) return false;

  const secrets = Array.isArray(secret) ? secret : [secret];
  if (secrets.length === 0) return false;

  const providedBuffer = Buffer.from(provided, 'hex');
  let isValid = false;

  for (const candidate of secrets) {
    const expected = crypto.createHmac('sha256', candidate).update(rawBody).digest('hex');

    // timingSafeEqual requires equal-length buffers
    if (provided.length === expected.length) {
      try {
        if (crypto.timingSafeEqual(providedBuffer, Buffer.from(expected, 'hex'))) {
          isValid = true;
        }
      } catch {
        // continue checking other candidates
      }
    }
  }

  return isValid;
}
