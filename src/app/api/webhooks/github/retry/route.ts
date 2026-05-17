import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer } from '@/lib/maintainer/detect';

/** Maximum number of times a dead-lettered event may be retried. */
const MAX_RETRIES = 5;

export async function POST(req: Request) {
  const sb = getServerSupabase();

  if (!sb) {
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const maintainer = await isUserMaintainer(user.id);

  if (!maintainer) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await req.json();

  const service = getServiceSupabase();

  if (!service) {
    return NextResponse.json({ error: 'db not available' }, { status: 500 });
  }

  const { data: failedEvent } = await service
    .from('failed_webhook_events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!failedEvent) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Guard against corrupted or missing event_type values.
  // Valid types follow the 'github/<event>' pattern set by the main
  // webhook handler in route.ts (e.g. 'github/pull_request',
  // 'github/installation', 'github/issues').
  const eventType: string | undefined = failedEvent.event_type;
  if (!eventType || !eventType.startsWith('github/')) {
    return NextResponse.json(
      { error: 'invalid event_type', event_type: eventType ?? null },
      { status: 422 },
    );
  }

  // Enforce a retry ceiling so the same event cannot be re-fired
  // indefinitely. retry_count is incremented each time the endpoint
  // is called; once it exceeds MAX_RETRIES the event is considered
  // permanently failed and must be investigated manually.
  const currentRetries: number = failedEvent.retry_count ?? 0;
  if (currentRetries >= MAX_RETRIES) {
    return NextResponse.json(
      {
        error: 'max retries exceeded',
        retry_count: currentRetries,
        max: MAX_RETRIES,
      },
      { status: 409 },
    );
  }

  // Increment retry_count *before* dispatching so the count is
  // durable even if the process crashes after Inngest accepts the
  // event but before we delete the row.
  await service
    .from('failed_webhook_events')
    .update({ retry_count: currentRetries + 1 })
    .eq('id', id);

  await inngest.send({
    name: eventType,
    data: failedEvent.payload,
  });

  // Clean up: remove the dead-letter row after a successful dispatch
  // so the table doesn't grow unboundedly.
  await service.from('failed_webhook_events').delete().eq('id', id);

  return NextResponse.json({ ok: true, event_type: eventType });
}
