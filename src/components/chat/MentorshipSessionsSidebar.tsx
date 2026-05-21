'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Participant = {
  id: string;
  github_handle: string;
  display_name: string | null;
  level: number | null;
};

type MentorshipSessionSummary = {
  id: number;
  mentor: Participant | null;
  mentee: Participant | null;
  level: number;
  started_at: string;
  ended_at: string | null;
};

export default function MentorshipSessionsSidebar() {
  const [sessions, setSessions] = useState<MentorshipSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/mentorship/sessions');
        if (!res.ok) {
          throw new Error('Unable to fetch mentorship sessions');
        }
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Active mentorship</h2>
          <p className="text-sm text-slate-400">Live sessions and participant levels.</p>
        </div>
        <Link href="/mentorship" className="text-sm text-sky-400 hover:text-sky-300">
          View all
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading sessions…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-500">No active mentorship sessions right now.</p>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/mentorship/${session.id}`}
              className="block rounded-3xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-600"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Session #{session.id}</div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400">
                  L{session.level}
                </span>
              </div>
              <div className="text-sm text-slate-300">
                Mentor: {session.mentor?.display_name ?? session.mentor?.github_handle ?? 'Unknown'}
              </div>
              <div className="text-sm text-slate-300">
                Mentee: {session.mentee?.display_name ?? session.mentee?.github_handle ?? 'Unknown'}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Started {new Date(session.started_at).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
