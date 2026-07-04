import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheGet, cacheSet } from '@/lib/cache';
import { TrendingUp, Box } from 'lucide-react';

type DashboardCache = {
  merges: number | null;
  streak: number | null;
  syncedAt: string | null;
};

type PartialProfile = {
  github_handle: string | null;
  xp: number;
  level: number;
  github_total_merges: number | null;
  github_streak: number | null;
  github_stats_synced_at: string | null;
} | null;

export const getDashCache = cache(
  async (userId: string, profile: PartialProfile): Promise<DashboardCache> => {
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
    return dashCache;
  },
);

export async function TotalMergesCard({
  userId,
  profile,
}: {
  userId: string;
  profile: PartialProfile;
}) {
  const dashCache = await getDashCache(userId, profile);
  const merges = dashCache.merges;

  return (
    <div className="flex h-full flex-col justify-center border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">TOTAL MERGES</div>
      <div className="flex items-end gap-2">
        <span className="font-serif text-4xl leading-none">
          {(merges ?? 0).toString().padStart(2, '0')}
        </span>
        <TrendingUp className="mb-1 h-4 w-4 text-[#00FF87]" />
      </div>
    </div>
  );
}

export function TotalMergesSkeleton() {
  return (
    <div className="flex h-full flex-col justify-center border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">TOTAL MERGES</div>
      <div className="flex items-end gap-2">
        <div className="h-9 w-16 animate-pulse rounded bg-zinc-800" />
        <div className="mb-1 h-4 w-4 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export async function MentorPointsCard({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  let mentorPoints = 0;

  if (service) {
    const { data: mentorEvents } = await service
      .from('xp_events')
      .select('xp_delta')
      .eq('user_id', userId)
      .in('source', ['review', 'help_review']);
    mentorPoints = mentorEvents?.reduce((acc, e) => acc + (e.xp_delta || 0), 0) || 0;
  }

  return (
    <div className="flex h-full flex-col justify-center border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">MENTOR POINTS</div>
      <div className="flex items-end gap-2">
        <span className="font-serif text-4xl leading-none">{mentorPoints.toLocaleString()}</span>
        <Box className="mb-1 h-5 w-5 text-zinc-400" />
      </div>
    </div>
  );
}

export function MentorPointsSkeleton() {
  return (
    <div className="flex h-full flex-col justify-center border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">MENTOR POINTS</div>
      <div className="flex items-end gap-2">
        <div className="h-9 w-24 animate-pulse rounded bg-zinc-800" />
        <div className="mb-1 h-5 w-5 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export async function CurrentStreakCard({
  userId,
  profile,
}: {
  userId: string;
  profile: PartialProfile;
}) {
  const dashCache = await getDashCache(userId, profile);
  const streak = dashCache.streak;

  return (
    <div className="flex h-full flex-col justify-center border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">CURRENT STREAK</div>
      <div className="flex items-end gap-2">
        <span className="font-serif text-4xl leading-none">
          {(streak ?? 0).toString().padStart(2, '0')}
        </span>
        <span className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">DAYS 🔥</span>
      </div>
    </div>
  );
}

export function CurrentStreakSkeleton() {
  return (
    <div className="flex h-full flex-col justify-center border border-zinc-800 bg-[#000E12] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">CURRENT STREAK</div>
      <div className="flex items-end gap-2">
        <div className="h-9 w-16 animate-pulse rounded bg-zinc-800" />
        <div className="mb-1 h-4 w-12 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}
