import { getServiceSupabase } from '@/lib/supabase/service';
import { ActivityHeatmap } from '@/components/activity-heatmap';

export default async function HeatmapWrapper({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  if (!service) return null;

  // Query merged PRs and XP events to build activity history
  const [{ data: prs }, { data: xpEvents }] = await Promise.all([
    service
      .from('pull_requests')
      .select('merged_at')
      .eq('author_user_id', userId)
      .eq('state', 'merged')
      .not('merged_at', 'is', null),
    service.from('xp_events').select('created_at').eq('user_id', userId),
  ]);

  // Count activity per day
  const countMap = new Map<string, number>();

  for (const pr of prs ?? []) {
    if (!pr.merged_at) continue;
    const date = pr.merged_at.slice(0, 10);
    countMap.set(date, (countMap.get(date) ?? 0) + 1);
  }
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
    <div className="border border-[#21262d] bg-[#161b22]/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse bg-zinc-800" />
          <div className="h-5 w-28 animate-pulse bg-zinc-800" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-3 w-3 animate-pulse rounded-sm bg-zinc-800" />
          ))}
        </div>
      </div>
      <div className="h-[105px] w-full animate-pulse bg-zinc-800/40" />
    </div>
  );
}
