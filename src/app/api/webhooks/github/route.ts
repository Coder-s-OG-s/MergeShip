import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhookSignature } from '@/lib/github/webhook-verify';
import { getServiceSupabase } from '@/lib/supabase/service';
import { inngest } from '@/inngest/client';

/**
 * GitHub App webhook receiver.
 *
 * Contract:
 *   1. HMAC verify against GITHUB_WEBHOOK_SECRET (401 if bad)
 *   2. Try INSERT into webhook_deliveries with the delivery UUID (UNIQUE)
 *      - conflict = duplicate retry, return 200 immediately
 *   3. Emit Inngest event for async processing, return 200 fast (<1s)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-hub-signature-256');
  const deliveryId = req.headers.get('x-github-delivery');
  const eventType = req.headers.get('x-github-event');

  if (!deliveryId || !eventType) {
    return NextResponse.json({ error: 'missing required headers' }, { status: 400 });
  }

  const raw = await req.text();

  if (!verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
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
  const { error: insertErr } = await supabase
    .from('webhook_deliveries')
    .insert({ id: deliveryId, event_type: eventType, payload_hash: payloadHash });

  let duplicate = false;
  if (insertErr) {
    if (insertErr.code === '23505') {
      duplicate = true;
    } else {
      return NextResponse.json(
        {
          error: 'persist failed',
          code: insertErr.code,
          message: insertErr.message,
          details: insertErr.details,
          hint: insertErr.hint,
        },
        { status: 500 },
      );
    }
  }

  await inngest.send({
    name: `github/${eventType}`,
    data: { deliveryId, eventType, payload: JSON.parse(raw) },
  });

  return NextResponse.json({ ok: true, duplicate });
}
