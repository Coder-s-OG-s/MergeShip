import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function POST(req: Request) {
  const { id } = await req.json();

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ error: 'db not available' }, { status: 500 });
  }

  const { data: failedEvent } = await sb
    .from('failed_webhook_events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!failedEvent) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  await inngest.send({
    name: 'github/pull_request',
    data: failedEvent.payload,
  });

  return NextResponse.json({ ok: true });
}
