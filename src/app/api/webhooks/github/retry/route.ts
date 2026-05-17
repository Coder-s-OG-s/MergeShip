import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer } from '@/lib/maintainer/detect';

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

  await inngest.send({
    name: eventType,
    data: failedEvent.payload,
  });

  return NextResponse.json({ ok: true, event_type: eventType });
}
