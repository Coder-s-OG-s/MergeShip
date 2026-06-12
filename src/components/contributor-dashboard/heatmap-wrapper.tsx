import { getServiceSupabase } from '@/lib/supabase/service';
import { ActivityHeatmap } from '@/components/activity-heatmap';

export default async function HeatmapWrapper({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  if (!service) return null;

  // Only query xp_events for git-related activity (no double-counting)
  const { data: xpEvents } = await service
    .from('xp_events')
    .select('created_at')
    .eq('user_id', userId)
    .in('source', ['recommended_merge', 'unrecommended_merge', 'help_review']);

  // Count activity per day — all time, no date filter
  const countMap = new Map<string, number>();
  for (const event of xpEvents ?? []) {
    if (!event.created_at) continue;
    const date = event.created_at.slice(0, 10);
    countMap.set(date, (countMap.get(date) ?? 0) + 1);
  }

  const activityHistory = Array.from(countMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  const totalAllTime = activityHistory.reduce((sum, d) => sum + d.count, 0);
  return <ActivityHeatmap activityHistory={activityHistory} allTimeContributions={totalAllTime} />;
}

export function HeatmapSkeleton() {
  return (
    <div className="border border-zinc-800 bg-[#161b22]/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse bg-zinc-800" />
          <div className="h-5 w-28 animate-pulse bg-zinc-800" />
        </div>
      </div>
      <div className="h-[105px] w-full animate-pulse bg-zinc-800/40" />
    </div>
  );
}
