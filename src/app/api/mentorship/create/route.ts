import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { createMentorshipSession } from '@/lib/chat';

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => null);
  const mentorHandle = body?.mentorHandle;
  if (!mentorHandle || typeof mentorHandle !== 'string') {
    return NextResponse.json({ error: 'mentorHandle is required' }, { status: 400 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Supabase service client not configured' }, { status: 500 });
  }

  const { data: mentorProfile, error: mentorError } = await service
    .from('profiles')
    .select('id')
    .eq('github_handle', mentorHandle)
    .maybeSingle();

  if (mentorError || !mentorProfile) {
    return NextResponse.json({ error: 'mentor_not_found' }, { status: 404 });
  }

  if (mentorProfile.id === user.id) {
    return NextResponse.json({ error: 'cannot_start_chat_with_self' }, { status: 400 });
  }

  const session = await createMentorshipSession({
    mentorId: mentorProfile.id,
    menteeId: user.id,
    level: 1,
  });

  return NextResponse.json({ session });
}
