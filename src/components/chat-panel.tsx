'use client';

import { useState, useEffect, useRef } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { getChatChannelMessages, sendChatMessage, markMessagesAsRead } from '@/app/actions/chat';
import { isOk } from '@/lib/result';
import { Send, Check, CheckCheck, Loader2 } from 'lucide-react';

type ChatMessageDetail = {
  id: number;
  channelId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
  sender: {
    githubHandle: string;
    avatarUrl: string | null;
  };
};

type ChatPanelProps = {
  channelId: string;
  currentUserId: string;
  currentUserHandle: string;
  currentUserAvatar: string | null;
  otherParticipantId: string;
  otherParticipantHandle: string;
  otherParticipantAvatar: string | null;
  isCompact?: boolean;
};

export function ChatPanel({
  channelId,
  currentUserId,
  currentUserHandle,
  currentUserAvatar,
  otherParticipantId,
  otherParticipantHandle,
  otherParticipantAvatar,
  isCompact = false,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageDetail[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);

  const supabase = getBrowserSupabase();

  // Fetch initial message history
  useEffect(() => {
    let active = true;
    async function loadMessages() {
      setLoading(true);
      try {
        const res = await getChatChannelMessages(channelId);
        if (isOk(res) && active) {
          // Normalize dates
          const normalized = res.data.map((m) => ({
            ...m,
            createdAt: new Date(m.createdAt),
            readAt: m.readAt ? new Date(m.readAt) : null,
          }));
          setMessages(normalized);
          // Mark all as read
          await markMessagesAsRead(channelId);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMessages();
    return () => {
      active = false;
    };
  }, [channelId]);

  // Realtime subscription & Presence
  useEffect(() => {
    if (!supabase) return;

    // 1. Subscribe to Message changes (INSERT/UPDATE)
    const channel = supabase
      .channel(`chat_messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const isSelf = newMsg.sender_id === currentUserId;
          const senderInfo = isSelf
            ? { githubHandle: currentUserHandle, avatarUrl: currentUserAvatar }
            : { githubHandle: otherParticipantHandle, avatarUrl: otherParticipantAvatar };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id,
                channelId: newMsg.channel_id,
                senderId: newMsg.sender_id,
                content: newMsg.content,
                readAt: newMsg.read_at ? new Date(newMsg.read_at) : null,
                createdAt: new Date(newMsg.created_at),
                sender: senderInfo,
              },
            ];
          });

          if (!isSelf) {
            await markMessagesAsRead(channelId);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMsg.id
                ? { ...m, readAt: updatedMsg.read_at ? new Date(updatedMsg.read_at) : null }
                : m,
            ),
          );
        },
      )
      .subscribe();

    // 2. Presence setup for Typing Indicators
    const presenceChannel = supabase.channel(`presence:${channelId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const isTyping = Object.values(state).some((presences: any) =>
          presences.some((p: any) => p.userId === otherParticipantId && p.typing),
        );
        setIsOtherTyping(isTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ userId: currentUserId, typing: false });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
    };
  }, [channelId, currentUserId, otherParticipantId]);

  // Track typing presence state changes
  useEffect(() => {
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({ userId: currentUserId, typing: isTyping });
    }
  }, [isTyping, currentUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Typing state management
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInputText('');
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const res = await sendChatMessage(channelId, trimmed);
      if (!isOk(res)) {
        console.error('Failed to send message:', res.error);
        setInputText(trimmed); // restore text if failed
      }
    } catch (err) {
      console.error('Failed to send:', err);
      setInputText(trimmed);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-purple-500" />
        <span>Syncing chat secure channel...</span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col border border-zinc-800 bg-[#0d1117] ${isCompact ? '' : 'rounded-2xl'}`}
    >
      {/* Header (Only show if not compact) */}
      {!isCompact && (
        <div className="flex items-center gap-3 rounded-t-2xl border-b border-zinc-800 bg-zinc-900/50 p-4">
          {otherParticipantAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherParticipantAvatar}
              alt=""
              className="h-9 w-9 rounded-full border border-zinc-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold">
              {otherParticipantHandle.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-[13px] font-bold text-white">@{otherParticipantHandle}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Mentorship session
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#0d1117] p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-500">
            <div className="mb-2 text-3xl">💬</div>
            <p className="text-[11px] uppercase tracking-widest">Secure channel initialized.</p>
            <p className="mt-1 text-xs text-zinc-600">
              Send a message to begin guiding or requesting help.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex max-w-[85%] gap-3 ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {!isSelf &&
                  (msg.sender.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.sender.avatarUrl}
                      alt=""
                      className="mt-1 h-7 w-7 shrink-0 rounded-full border border-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold">
                      {msg.sender.githubHandle.substring(0, 2).toUpperCase()}
                    </div>
                  ))}
                <div>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      isSelf
                        ? 'rounded-tr-none bg-purple-600 text-white'
                        : 'rounded-tl-none border border-zinc-700 bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div
                    className={`mt-1 flex items-center gap-1.5 text-[9px] text-zinc-500 ${isSelf ? 'justify-end' : ''}`}
                  >
                    <span>
                      {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isSelf &&
                      (msg.readAt ? (
                        <CheckCheck className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Check className="h-3 w-3 text-zinc-600" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex items-center gap-3 text-zinc-500">
            {otherParticipantAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={otherParticipantAvatar}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-zinc-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold">
                {otherParticipantHandle.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg rounded-tl-none border border-zinc-800 bg-zinc-900 px-3 py-2">
              <span className="text-[11px] text-zinc-500">@{otherParticipantHandle} is typing</span>
              <span className="ml-1 flex items-center gap-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-500" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-500 [animation-delay:0.2s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-500 [animation-delay:0.4s]" />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-zinc-800 bg-zinc-900/50 p-3"
      >
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="flex items-center justify-center rounded-md bg-purple-600 p-2 text-white transition-colors hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
