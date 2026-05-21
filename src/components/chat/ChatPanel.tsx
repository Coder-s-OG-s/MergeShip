'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserSupabase, isSupabaseConfigured } from '@/lib/supabase/browser';

type ChatMessage = {
  id: number;
  session_id: number;
  sender_id: string;
  content: string;
  timestamp: string;
  read_status: 'unread' | 'read';
  sender?: {
    github_handle: string;
    display_name: string | null;
  };
};

type ChatPanelProps = {
  sessionId: string;
  currentUserId: string;
  mentorHandle: string;
  menteeHandle: string;
};

export default function ChatPanel({
  sessionId,
  currentUserId,
  mentorHandle,
  menteeHandle,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const isSupabase = isSupabaseConfigured();

  const displayName = useMemo(() => {
    if (currentUserId) {
      return currentUserId;
    }
    return 'you';
  }, [currentUserId]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/mentorship/messages?sessionId=${encodeURIComponent(sessionId)}`,
      );
      if (!res.ok) {
        throw new Error('Failed to load chat history');
      }
      setMessages(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    let channel: any;
    let ws: WebSocket | null = null;

    if (isSupabase) {
      const supabase = getBrowserSupabase();
      if (supabase) {
        channel = supabase.channel(`mentorship:${sessionId}`);

        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload: any) => {
            setMessages((current) => [...current, payload.new]);
          },
        );

        channel.on('presence', { event: 'sync' }, () => {
          const state = (channel as any).presenceState?.() ?? {};
          const people = Object.values(state)
            .flatMap((members: any) =>
              members.map((member: any) => member.user_id ?? member.user.user_id),
            )
            .filter(Boolean) as string[];
          setTypingUsers(people);
        });

        channel.subscribe().then(() => setRealtimeEnabled(true));
      }
    } else if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_CHAT_WS_URL) {
      const url = new URL(process.env.NEXT_PUBLIC_CHAT_WS_URL, window.location.href);
      url.searchParams.set('sessionId', sessionId);
      ws = new WebSocket(url.toString());
      socketRef.current = ws;

      ws.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'message') {
            setMessages((current) => [...current, payload.message]);
          }
          if (payload.type === 'presence') {
            setTypingUsers(payload.users ?? []);
          }
        } catch {
          // ignore malformed socket payloads
        }
      });
      ws.addEventListener('open', () => setRealtimeEnabled(true));
    }

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      if (ws) {
        ws.close();
      }
    };
  }, [isSupabase, sessionId]);

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    setError(null);

    try {
      const res = await fetch('/api/mentorship/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: Number(sessionId), content: messageText.trim() }),
      });
      if (!res.ok) {
        throw new Error('Unable to send message');
      }
      setMessageText('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const typingLabel = typingUsers.length
    ? `${typingUsers.filter((id) => id !== currentUserId).join(', ')} is typing...`
    : '';

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-black/10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Mentorship chat</p>
          <h2 className="text-xl font-semibold text-white">
            {mentorHandle} ↔ {menteeHandle}
          </h2>
          <p className="text-xs text-slate-500">
            {realtimeEnabled ? 'Realtime active' : 'Realtime fallback'}
          </p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-widest text-slate-400">
          {typingUsers.length ? 'Typing' : 'Live'}
        </span>
      </div>

      <div className="mb-4 rounded-3xl border border-slate-800 bg-[#0f172a] p-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Transparency notice</p>
        <p className="text-sm text-slate-300">
          All mentorship chats are logged for transparency. Messages are recorded and available for
          maintainer review.
        </p>
      </div>

      <div className="mb-4 max-h-[420px] space-y-3 overflow-y-auto pr-2">
        {loading && <p className="text-sm text-slate-500">Loading chat history…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p>
        )}
        {messages.map((message) => {
          const isOwn = message.sender_id === currentUserId;
          const senderLabel =
            message.sender?.display_name ||
            message.sender?.github_handle ||
            (isOwn ? 'You' : 'Mentor');
          return (
            <div
              key={message.id}
              className={`rounded-2xl p-3 ${isOwn ? 'self-end bg-slate-800 text-right' : 'bg-slate-900 text-left'}`}
            >
              <div className="mb-1 text-[11px] uppercase tracking-widest text-slate-500">
                {senderLabel}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                {message.content}
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {typingLabel && <div className="mb-3 text-sm text-emerald-300">{typingLabel}</div>}
      {error && (
        <div className="mb-3 rounded-xl bg-rose-950 p-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="flex gap-3">
        <textarea
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          rows={3}
          placeholder="Type your message…"
          className="min-h-[90px] flex-1 resize-none rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={sendMessage}
          className="rounded-3xl bg-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}
