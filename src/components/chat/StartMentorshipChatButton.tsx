'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartMentorshipChatButton({ mentorHandle }: { mentorHandle: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startChat = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/mentorship/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorHandle }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Unable to start mentorship chat');
      }
      const data = await res.json();
      router.push(`/mentorship/${data.session.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={startChat}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Starting chat…' : 'Start Mentorship Chat'}
      </button>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  );
}
