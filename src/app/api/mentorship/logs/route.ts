import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer } from '@/lib/maintainer/detect';

function csvEscape(value: string | null | undefined) {
  const text = value ?? '';
  return `"${text.replace(/"/g, '""')}"`;
}

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

  if (!(await isUserMaintainer(user.id))) {
    return NextResponse.json({ error: 'not_authorised' }, { status: 403 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Supabase service client not configured' }, { status: 500 });
  }

  const format = req.nextUrl.searchParams.get('format') ?? 'json';
  const { data: sessions, error: sessionsError } = await service
    .from('mentorship_sessions')
    .select(
      'id, mentor_id, mentee_id, level, started_at, ended_at, mentor:profiles(id, github_handle, display_name), mentee:profiles(id, github_handle, display_name)',
    )
    .order('started_at', { ascending: false });

  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: messages, error: messagesError } = await service
    .from('messages')
    .select(
      'id, session_id, sender_id, content, timestamp, read_status, sender:profiles(id, github_handle)',
    )
    .in('session_id', sessionIds)
    .order('timestamp', { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const payload = {
    sessions: sessions ?? [],
    messages: messages ?? [],
  };

  if (format === 'csv') {
    const rows = [
      'session_id,mentor_handle,mentee_handle,level,started_at,ended_at,message_id,sender_handle,message,timestamp,read_status',
    ];
    for (const session of payload.sessions) {
      const sessionMessages = payload.messages.filter(
        (message) => message.session_id === session.id,
      );
      if (sessionMessages.length === 0) {
        rows.push(
          [
            session.id,
            session.mentor?.[0]?.github_handle ?? '',
            session.mentee?.[0]?.github_handle ?? '',
            session.level,
            session.started_at,
            session.ended_at ?? '',
            '',
            '',
            '',
            '',
            '',
          ].join(','),
        );
      }
      for (const message of sessionMessages) {
        rows.push(
          [
            session.id,
            session.mentor?.[0]?.github_handle ?? '',
            session.mentee?.[0]?.github_handle ?? '',
            session.level,
            session.started_at,
            session.ended_at ?? '',
            message.id,
            message.sender?.[0]?.github_handle ?? '',
            csvEscape(message.content),
            message.timestamp,
            message.read_status,
          ].join(','),
        );
      }
    }

    return new Response(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mentorship-logs.csv"',
      },
    });
  }

  return NextResponse.json(payload);
}
