'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { getOrCreateChatChannel } from '@/app/actions/chat';
import { isOk } from '@/lib/result';

type StartChatButtonProps = {
  targetUserId: string;
  targetHandle: string;
};

export function StartChatButton({ targetUserId, targetHandle }: StartChatButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStartChat = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrCreateChatChannel(targetUserId);
      if (isOk(res)) {
        router.push(`/help-inbox?channelId=${res.data.channelId}`);
      } else {
        setError(res.error.message || 'Failed to start chat');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleStartChat}
        disabled={loading}
        className="flex items-center gap-2 border border-[#10b981] bg-[#10b981]/5 px-4 py-2 text-[11px] uppercase tracking-widest text-[#10b981] transition-colors hover:bg-[#10b981]/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {loading ? 'STARTING CHAT...' : 'START MENTORSHIP CHAT'}
      </button>
      {error && (
        <span className="mt-1 text-[10px] uppercase tracking-wider text-red-400">{error}</span>
      )}
    </div>
  );
}
