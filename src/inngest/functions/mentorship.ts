import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

export const mentorship = inngest.createFunction(
  { id: 'mentorship' },
  {
    event: 'mentorship.*',
  },
  async ({ event }) => {
    const sb = getServiceSupabase();
    if (!sb) return;

    if (event.name === 'mentorship.session.created') {
      await sb.from('activity_log').insert({
        user_id: event.data.mentorId,
        kind: 'mentorship.session.created',
        detail: event.data,
      });
      return;
    }

    if (event.name === 'mentorship.message.sent') {
      const content = String(event.data.content || '').toLowerCase();
      const flagged =
        content.includes('inappropriate') || content.includes('hate') || content.includes('abuse');
      await sb.from('activity_log').insert({
        user_id: event.data.senderId,
        kind: 'mentorship.message.sent',
        detail: event.data,
      });
      if (flagged) {
        await sb.from('activity_log').insert({
          user_id: event.data.senderId,
          kind: 'mentorship.message.flagged',
          detail: {
            sessionId: event.data.sessionId,
            messageId: event.data.messageId,
            reason: 'possible inappropriate content',
            content: event.data.content,
          },
        });
      }
      return;
    }

    if (event.name === 'mentorship.session.ended') {
      const { data: sessionMessages } = await sb
        .from('messages')
        .select('content, sender_id')
        .eq('session_id', event.data.sessionId)
        .order('timestamp', { ascending: true });

      const summary = sessionMessages
        ? sessionMessages
            .slice(0, 5)
            .map((message: any) => `${message.sender_id}: ${message.content}`)
            .join(' | ')
        : 'No messages recorded.';

      await sb.from('activity_log').insert({
        user_id: event.data.mentorId,
        kind: 'mentorship.session.summary',
        detail: {
          sessionId: event.data.sessionId,
          summary,
        },
      });
      return;
    }
  },
);
