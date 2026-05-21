import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Supabase service client not configured' }, { status: 500 });
  }

  const { data: messages, error } = await service
    .from('messages')
    .select(
      'id, session_id, sender_id, content, timestamp, read_status, sender:profiles(id, github_handle, display_name)',
    )
    .eq('session_id', Number(sessionId))
    .order('timestamp', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(messages ?? []);
}
