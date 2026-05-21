import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(req: Request) {
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

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Supabase service client not configured' }, { status: 500 });
  }

  const filter = `mentor_id.eq.${user.id},mentee_id.eq.${user.id}`;
  const { data: sessions, error } = await service
    .from('mentorship_sessions')
    .select(
      'id, level, started_at, ended_at, mentor:profiles(id, github_handle, display_name, level), mentee:profiles(id, github_handle, display_name, level)',
    )
    .or(filter)
    .eq('ended_at', null)
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: sessions ?? [] });
}
