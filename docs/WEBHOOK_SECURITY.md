# GitHub Webhook Security

## Overview

MergeShip receives GitHub webhook events to process pull requests, manage contributor levels, and award XP. To prevent forged webhook payloads, all webhooks are cryptographically verified using HMAC-SHA256.

## Signature Verification

### Implementation

All incoming webhooks are verified in `src/app/api/webhooks/github/route.ts` before processing:

```typescript
import { verifyWebhookSignature } from '@/lib/github/webhook-verify';

if (!verifyWebhookSignature(raw, signature, secret)) {
  return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
}
```

### How It Works

1. GitHub sends each webhook with an `X-Hub-Signature-256` header
2. The header contains: `sha256=<HMAC-SHA256 hex>`
3. Server verifies using `GITHUB_WEBHOOK_SECRET` environment variable
4. Signature mismatch → immediate rejection (HTTP 401)

### Timing Attack Protection

The verification uses `crypto.timingSafeEqual()` to prevent timing-based attacks:

```typescript
crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))
```

This ensures signature verification takes the same time regardless of where the mismatch occurs, preventing attackers from using response time to recover partial signatures.

## Configuration

### Required Environment Variables

Set in your deployment platform:

```bash
GITHUB_WEBHOOK_SECRET="your_github_webhook_secret_here"
```

### GitHub Setup

In your GitHub App settings:

1. Set Webhook URL: `https://mergeship.example.com/api/webhooks/github`
2. Set Webhook Secret: A random, cryptographically-secure string
3. Enable events:
   - Pull Request
   - Pull Request Review
   - Issue Comment
   - Any other events you need

### Secret Rotation

If the webhook secret is compromised:

1. **Immediately**:
   - Update `GITHUB_WEBHOOK_SECRET` in your deployment
   - Redeploy the application
   - GitHub will retry failed deliveries

2. **In GitHub Settings**:
   - Generate a new webhook secret
   - Update your app settings
   - Old secret stops working immediately

## Attack Prevention

### What This Defends Against

- **Forged Events**: Attacker cannot create valid signatures without the secret
- **XP Manipulation**: Cannot award XP without legitimate GitHub event
- **Level Promotion**: Cannot promote contributors without verified merge events
- **Leaderboard Gaming**: Cannot manipulate rankings without valid webhooks

### What This Does NOT Defend Against

- **Lost Secret**: If `GITHUB_WEBHOOK_SECRET` is exposed, signature verification fails (immediate detection needed)
- **MITM**: TLS/HTTPS must be properly configured to prevent interception
- **Replay Attacks**: Mitigated by idempotency checks and Supabase `UNIQUE` constraints

## Testing

The verification function is thoroughly tested in `src/lib/github/webhook-verify.test.ts`:

```bash
npm test -- webhook-verify
```

Tests cover:
- Valid signatures accepted
- Tampered payloads rejected
- Wrong secret rejected
- Missing/malformed headers rejected
- Timing-attack resistance

## Monitoring

Monitor for signature verification failures:

```typescript
if (!verifyWebhookSignature(raw, sig, secret)) {
  console.warn('[webhook] signature verification failed', {
    deliveryId,
    eventType,
    timestamp: new Date(),
  });
}
```

Repeated failures may indicate:
- Misconfigured secret
- GitHub App redeployment
- Potential attack attempts

## FAQ

**Q: Why use timingSafeEqual?**  
A: Prevents attackers from using response time to guess valid signatures bit-by-bit.

**Q: Can I disable signature verification?**  
A: No. Missing `GITHUB_WEBHOOK_SECRET` returns HTTP 503. This is intentional.

**Q: What if I forget to set the secret?**  
A: Webhooks return 503 Service Unavailable. Configure and redeploy.

**Q: Are retried webhooks verified again?**  
A: Yes. Every delivery, including retries, must have a valid signature.
