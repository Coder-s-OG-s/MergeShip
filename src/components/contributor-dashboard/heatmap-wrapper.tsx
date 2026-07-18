import { ActivityHeatmap } from '@/components/activity-heatmap';
import { totalContributions } from '@/lib/contributions/activity-history';
import { loadActivityHistory } from '@/lib/contributions/load-activity-history';

export default async function HeatmapWrapper({ userId }: { userId: string }) {
  const activityHistory = await loadActivityHistory(userId);
  const totalAllTime = totalContributions(activityHistory);
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
