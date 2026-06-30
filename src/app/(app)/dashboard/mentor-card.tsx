import { Calendar } from 'lucide-react';

// Static data — replace with DB queries when `mentor_sessions` table exists
const NEXT_SESSION = {
  mentor: 'priya.codes',
  date: 'TBD',
  time: '—',
  note: 'No session scheduled yet.',
};

export function MentorCard() {
  const hasScheduledSession = NEXT_SESSION.date !== 'TBD';
  return (
    <section className="flex h-full flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Calendar className="h-3.5 w-3.5 text-zinc-600" />
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">NEXT MENTOR SESSION</h2>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {!hasScheduledSession ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
              <span className="text-2xl text-zinc-500">+</span>
            </div>
            <p className="mb-4 text-sm text-zinc-400">
              You haven't connected with any mentors yet.
            </p>
            <button className="mt-2 rounded bg-[#00FF87] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#00FF87]/80">
              FIND A MENTOR
            </button>
          </div>
        ) : (
          <div className="flex-1">
            <div className="mb-1 text-[12px] text-zinc-300">{NEXT_SESSION.mentor}</div>
            <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-600">
              {NEXT_SESSION.note}
            </div>
            <div className="flex gap-2">
              <button
                disabled={!hasScheduledSession}
                className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                RESCHEDULE
              </button>
              <button
                disabled={!hasScheduledSession}
                className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                JOIN CALL
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function MentorSkeleton() {
  return (
    <section className="flex h-full flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 h-4 w-32 animate-pulse bg-zinc-800" />
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6">
        <div className="mb-4 h-12 w-12 animate-pulse rounded-full bg-zinc-800" />
        <div className="mb-2 h-4 w-48 animate-pulse bg-zinc-800" />
        <div className="h-4 w-24 animate-pulse bg-zinc-800" />
      </div>
    </section>
  );
}
