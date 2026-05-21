import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { appendMentorshipMessage } from '@/lib/chat';

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
  const sessionId = Number(body?.sessionId);
  const content = body?.content;

  if (!sessionId || !content || typeof content !== 'string') {
    return NextResponse.json({ error: 'sessionId and content are required' }, { status: 400 });
  }

  const message = await appendMentorshipMessage({
    sessionId,
    senderId: user.id,
    content: content.trim(),
  });

  return NextResponse.json({ message });
}
