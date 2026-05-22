import { getServiceSupabase } from '@/lib/supabase/service';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';
import { cacheGet, cacheSet } from '@/lib/cache';
import { TrendingUp, Box } from 'lucide-react';

type DashboardCache = {
  merges: number | null;
  streak: number | null;
  syncedAt: string | null;
};

function levelProgressPct(xp: number, level: number): number {
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  if (ceiling <= floor) return 100;
  const pct = ((xp - floor) / (ceiling - floor)) * 100;
  return Math.max(0, Math.min(100, pct));
}

type PartialProfile = {
  github_handle: string | null;
  xp: number;
  level: number;
  github_total_merges: number | null;
  github_streak: number | null;
  github_stats_synced_at: string | null;
} | null;

export default async function StatsRow({
  userId,
  profile,
}: {
  userId: string;
  profile: PartialProfile;
}) {
  const service = getServiceSupabase();
  if (!service) return null;

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const { needed, next } = xpToNextLevel(xp);
  const nextLevel = next ?? level;

  // Read stats from Redis cache, fall back to profile data
  const cacheKey = `gh:dashboard:${userId}`;
  let dashCache = await cacheGet<DashboardCache>(cacheKey);

  if (!dashCache) {
    dashCache = {
      merges: (profile?.github_total_merges as number | null) ?? null,
      streak: (profile?.github_streak as number | null) ?? null,
      syncedAt: (profile?.github_stats_synced_at as string | null) ?? null,
    };
    await cacheSet(cacheKey, dashCache, 300);
  }

  // Mentor points
  const { data: mentorEvents } = await service
    .from('xp_events')
    .select('xp_delta')
    .eq('user_id', userId)
    .in('source', ['review', 'help_review']);
  const mentorPoints = mentorEvents?.reduce((acc, e) => acc + (e.xp_delta || 0), 0) || 0;

  const merges = dashCache.merges;
  const streak = dashCache.streak;

  return (
    <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
      {/* Level Progress */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          LEVEL PROGRESS
        </div>
        <div className="flex items-center gap-4">
          <div className="border border-zinc-700 px-3 py-2 font-serif text-xl text-zinc-300">
            L{level}
          </div>
          <div className="flex-1">
            <div className="mb-2 h-1.5 w-full overflow-hidden bg-[#1c2128]">
              <div
                className="h-full bg-[#10b981]"
                style={{ width: `${levelProgressPct(xp, level)}%` }}
              />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              {xp.toLocaleString()} / {(xp + needed).toLocaleString()} XP TO L{nextLevel}
            </div>
          </div>
        </div>
      </div>

      {/* Total Merges */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">TOTAL MERGES</div>
        <div className="flex items-end gap-2">
          <span className="font-serif text-4xl leading-none">
            {(merges ?? 0).toString().padStart(2, '0')}
          </span>
          <TrendingUp className="mb-1 h-4 w-4 text-[#10b981]" />
        </div>
      </div>

      {/* Mentor Points */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          MENTOR POINTS
        </div>
        <div className="flex items-end gap-2">
          <span className="font-serif text-4xl leading-none">{mentorPoints.toLocaleString()}</span>
          <Box className="mb-1 h-5 w-5 text-zinc-400" />
        </div>
      </div>

      {/* Current Streak */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          CURRENT STREAK
        </div>
        <div className="flex items-end gap-2">
          <span className="font-serif text-4xl leading-none">
            {(streak ?? 0).toString().padStart(2, '0')}
          </span>
          <span className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">DAYS 🔥</span>
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
      {/* Level Progress Skeleton */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          LEVEL PROGRESS
        </div>
        <div className="flex items-center gap-4">
          <div className="h-11 w-12 animate-pulse border border-zinc-700 bg-zinc-800" />
          <div className="flex-1">
            <div className="mb-2 h-1.5 w-full animate-pulse bg-zinc-800" />
            <div className="h-3 w-3/4 animate-pulse bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Total Merges Skeleton */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">TOTAL MERGES</div>
        <div className="flex items-end gap-2">
          <div className="h-9 w-16 animate-pulse rounded bg-zinc-800" />
          <div className="mb-1 h-4 w-4 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>

      {/* Mentor Points Skeleton */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          MENTOR POINTS
        </div>
        <div className="flex items-end gap-2">
          <div className="h-9 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="mb-1 h-5 w-5 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>

      {/* Current Streak Skeleton */}
      <div>
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          CURRENT STREAK
        </div>
        <div className="flex items-end gap-2">
          <div className="h-9 w-16 animate-pulse rounded bg-zinc-800" />
          <div className="mb-1 h-4 w-12 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
