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

  // Idempotency: if this delivery already arrived, drop it.
  const { error: insertErr } = await supabase
    .from('webhook_deliveries')
    .insert({ id: deliveryId, event_type: eventType, payload_hash: payloadHash });

  if (insertErr) {
    // 23505 = unique_violation in Postgres
    if (insertErr.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Surface the real error so misconfigurations are visible in GitHub's
    // delivery view. GitHub is the only caller; nothing sensitive leaks.
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

  await inngest.send({
    name: `github/${eventType}`,
    data: { deliveryId, eventType, payload: JSON.parse(raw) },
  });

  return NextResponse.json({ ok: true });
}
