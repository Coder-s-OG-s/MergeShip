import { getServiceSupabase } from '@/lib/supabase/service';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';

function levelProgressPct(xp: number, level: number): number {
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  if (ceiling <= floor) return 100;
  const pct = ((xp - floor) / (ceiling - floor)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export default async function JourneyProgress({ xp, level }: { xp: number; level: number }) {
  const { needed, next } = xpToNextLevel(xp);
  const nextLevel = next ?? level + 1;
  const pct = Math.round(levelProgressPct(xp, level));

  return (
    <div className="border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-zinc-500">
          L{level} → L{nextLevel} JOURNEY
        </h3>
        <span className="font-serif text-sm text-[#00FF87]">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 w-full overflow-hidden bg-[#0d1117]">
        <div
          className="h-full bg-[#00FF87] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-600">
        <span>{xp.toLocaleString()} XP</span>
        <span>
          {needed.toLocaleString()} XP TO L{nextLevel}
        </span>
      </div>
    </div>
  );
}

export function JourneyProgressSkeleton() {
  return (
    <div className="border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-3 w-32 animate-pulse bg-zinc-800" />
        <div className="h-3 w-8 animate-pulse bg-zinc-800" />
      </div>
      <div className="mb-3 h-2 w-full animate-pulse bg-zinc-800" />
      <div className="flex justify-between">
        <div className="h-3 w-16 animate-pulse bg-zinc-800" />
        <div className="h-3 w-24 animate-pulse bg-zinc-800" />
      </div>
    </div>
  );
}
