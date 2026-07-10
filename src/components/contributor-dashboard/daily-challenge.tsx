'use client';

import { useEffect, useState } from 'react';
import { getDailyChallenge, type DailyChallengeData } from '@/app/actions/daily-challenge';

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
  const [challenge, setChallenge] = useState<DailyChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getDailyChallenge();
        if (res.ok) {
          setChallenge(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const tick = () => setSecs(getSecondsUntilMidnightUTC());
    tick();
    const id = setInterval(() => {
      setSecs((prev) => (prev === null || prev <= 1 ? getSecondsUntilMidnightUTC() : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">DAILY CHALLENGE</h2>
          <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">
            --:--:--
          </span>
        </div>
        <div className="h-[110px] animate-pulse border border-zinc-800 bg-[#161b22] p-4" />
      </section>
    );
  }

  if (!challenge) {
    return null;
  }

  const pct = Math.min(100, Math.round((challenge.current / challenge.goal) * 100));
  const done = challenge.completed || challenge.current >= challenge.goal;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">DAILY CHALLENGE</h2>
        <span
          className={`font-mono text-[11px] uppercase tracking-widest ${done ? 'text-[#10b981]' : 'text-amber-400'}`}
        >
          {done ? 'COMPLETE ✓' : secs === null ? '--:--:--' : formatCountdown(secs)}
        </span>
      </div>

      <div className="border border-zinc-800 bg-[#161b22] p-4">
        <div className="mb-1 text-[13px] text-zinc-200">{challenge.title}</div>
        <div className="mb-4 text-[11px] text-zinc-500">{challenge.description}</div>

        {/* Progress bar */}
        <div className="mb-2 h-1.5 w-full overflow-hidden bg-[#000E12]">
          <div
            className={`h-full transition-all duration-500 ${done ? 'bg-[#10b981]' : 'bg-[#00FF87]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-600">
          <span>
            {challenge.current} / {challenge.goal} DONE
          </span>
          <span className="text-[#10b981]">+{challenge.xpReward} XP</span>
        </div>
      </div>
    </section>
  );
}
