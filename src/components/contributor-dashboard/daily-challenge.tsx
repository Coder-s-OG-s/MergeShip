'use client';

import { useEffect, useState } from 'react';

// Static challenge data — replace with a DB query when a `daily_challenges` table exists
const CHALLENGE = {
  title: 'Comment on 2 open issues today',
  description: 'Leave a helpful comment on any 2 open issues in the org.',
  goal: 2,
  current: 0, // TODO: wire to real progress when table exists
  xpReward: 50,
};

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((secs % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function DailyChallenge() {
  const [secs, setSecs] = useState(getSecondsUntilMidnightUTC());

  useEffect(() => {
    const id = setInterval(() => {
      setSecs((prev) => (prev <= 1 ? getSecondsUntilMidnightUTC() : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, Math.round((CHALLENGE.current / CHALLENGE.goal) * 100));
  const done = CHALLENGE.current >= CHALLENGE.goal;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">DAILY CHALLENGE</h2>
        <span
          className={`font-mono text-[11px] uppercase tracking-widest ${done ? 'text-[#10b981]' : 'text-amber-400'}`}
        >
          {done ? 'COMPLETE ✓' : formatCountdown(secs)}
        </span>
      </div>

      <div className="border border-zinc-800 bg-[#161b22] p-4">
        <div className="mb-1 text-[13px] text-zinc-200">{CHALLENGE.title}</div>
        <div className="mb-4 text-[11px] text-zinc-500">{CHALLENGE.description}</div>

        {/* Progress bar */}
        <div className="mb-2 h-1.5 w-full overflow-hidden bg-[#000E12]">
          <div
            className={`h-full transition-all duration-500 ${done ? 'bg-[#10b981]' : 'bg-[#00FF87'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-600">
          <span>
            {CHALLENGE.current} / {CHALLENGE.goal} DONE
          </span>
          <span className="text-[#10b981]">+{CHALLENGE.xpReward} XP</span>
        </div>
      </div>
    </section>
  );
}
