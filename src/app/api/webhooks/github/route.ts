import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhookSignature } from '@/lib/github/webhook-verify';
import { getServiceSupabase } from '@/lib/supabase/service';
import { inngest } from '@/inngest/client';
import { rateLimit } from '@/lib/rate-limit';

/**
 * GitHub App webhook receiver.
 *
 * Contract:
 *   1. HMAC verify against GITHUB_WEBHOOK_SECRET (401 if bad)
 *   2. Ignore event types the app never handles (200 immediately, no INSERT)
 *   3. Rate limit per installation + event type, so noise can't starve
 *      business-critical events (pull_request, issues, ...)
 *   4. Try INSERT into webhook_deliveries with the delivery UUID (UNIQUE)
 *      - conflict = duplicate retry, return 200 immediately
 *   5. Emit Inngest event for async processing, return 200 fast (<1s)
 *
 * Fail-soft: never return 5xx for an accepted, signature-verified webhook.
 * GitHub does not auto-redeliver failed deliveries, so a 429/500 would
 * permanently lose business-critical events (merged-PR XP, claims, ...).
 * Rate-limit misses return 429 (honest, and per-event buckets make it rare);
 * transient DB/send failures degrade to best-effort dispatch + a
 * failed_webhook_events row the maintainer retry endpoint can replay.
 */

/** GitHub webhook event types that have an Inngest handler. */
const HANDLED_EVENTS = new Set([
  'pull_request',
  'pull_request_review',
  'issues',
  'issue_comment',
  'installation',
  'installation_repositories',
  'membership',
  'member',
]);

export async function POST(req: NextRequest) {
  const secretEnv = process.env.GITHUB_WEBHOOK_SECRETS || process.env.GITHUB_WEBHOOK_SECRET;
  if (!secretEnv) {
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 });
  }

  const secrets = secretEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (secrets.length === 0) {
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 });
  }

  if (secrets.length > 2) {
    console.warn(
      '[webhook] more than 2 secrets configured; please clean up old secrets after rotation',
    );
  }

  const signature = req.headers.get('x-hub-signature-256');
  const deliveryId = req.headers.get('x-github-delivery');
  const eventType = req.headers.get('x-github-event');

  if (!deliveryId || !eventType) {
    return NextResponse.json({ error: 'missing required headers' }, { status: 400 });
  }

  const raw = await req.text();

  if (!verifyWebhookSignature(raw, signature, secrets)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  // Whitelist BEFORE rate limiting or persisting. Unhandled event types
  // (push, create, delete, star, watch, ping, meta, ...) are acknowledged
  // with a 2xx and never written to webhook_deliveries, so the table only
  // grows with deliveries the app actually consumes.
  if (!HANDLED_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payload = JSON.parse(raw);

  const installationId = payload.installation?.id;
  // If there is no installation ID (e.g. meta, security_advisory events),
  // we fall back to a global bucket per event type. This prevents DDoS
  // via IP spoofing (e.g. forging x-forwarded-for) with leaked secrets.
  // Buckets are split per event type so a burst of one event can't starve
  // a business-critical event (e.g. pull_request) on the same install.
  const rateLimitKey = installationId
    ? `install:${installationId}:${eventType}`
    : `global:${eventType}`;

  const limited = await rateLimit({
    namespace: 'webhook',
    key: rateLimitKey,
    limit: 100,
    windowSec: 60,
  });

  if (!limited.ok) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 });
  }

  const payloadHash = crypto.createHash('sha256').update(raw).digest('hex');
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'storage not configured' }, { status: 503 });
  }

  // Record the delivery. Duplicate UUIDs (replays from GitHub's "Redeliver"
  // button) are still forwarded to Inngest — the downstream functions are
  // idempotent on their own writes via UNIQUE constraints, so a replay is
  // safe and sometimes necessary to recover from a prior failure.
  let duplicate = false;
  const { error: insertErr } = await supabase
    .from('webhook_deliveries')
    .insert({ id: deliveryId, event_type: eventType, payload_hash: payloadHash });

  if (insertErr) {
    if (insertErr.code === '23505') {
      duplicate = true;
    } else {
      // Transient DB failure must not become a permanent event drop. Log it
      // for ops, then continue with best-effort dispatch below — the
      // downstream functions are idempotent, so the event still processes.
      console.error('[webhook] failed to persist delivery, dispatching best-effort', {
        deliveryId,
        eventType,
        code: insertErr.code,
        message: insertErr.message,
        details: insertErr.details,
        hint: insertErr.hint,
      });
    }
  }

  try {
    await inngest.send({
      name: `github/${eventType}`,
      data: { deliveryId, eventType, payload },
    });
  } catch (e) {
    // Persist the undeliverable event so the maintainer retry endpoint
    // (/api/webhooks/github/retry) can replay it, then ack with 2xx —
    // never a 500, which GitHub would mark as failed and never redeliver.
    const sendError = e as Error;
    console.error('[webhook] inngest.send failed', {
      deliveryId,
      eventType,
      message: sendError.message,
    });
    const { error: failedInsert } = await supabase.from('failed_webhook_events').insert({
      delivery_id: deliveryId,
      event_type: `github/${eventType}`,
      source: 'webhook/route',
      payload: { deliveryId, eventType, payload },
      error: `[webhook] inngest.send failed: ${sendError.message}`,
      retry_count: 0,
      installation_id: installationId ?? null,
    });
    if (failedInsert) {
      console.error('[webhook] failed to persist dead-letter row', {
        deliveryId,
        message: failedInsert.message,
      });
    }
    return NextResponse.json({ ok: true, duplicate, dispatched: false }, { status: 202 });
  }

  return NextResponse.json({ ok: true, duplicate });
}
