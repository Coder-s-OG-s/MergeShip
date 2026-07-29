import type { MaintainerDashboardStats } from '@/app/actions/maintainer/types';

export function DashboardStats({ stats }: { stats: MaintainerDashboardStats }) {
  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile title="Open PRs" value={stats.openPrs.toString()} />
      <StatTile title="AI Flagged" value={stats.aiFlagged.toString()} />
      <StatTile title="Ready to Merge" value={stats.readyToMerge.toString()} />
      <StatTile title="Clean Rate %" value={stats.cleanRate === 0 ? '—' : `${stats.cleanRate}%`} />
      <StatTile
        title="Average Review Time"
        value={stats.avgReviewTimeHours > 0 ? `${stats.avgReviewTimeHours}h` : '—'}
      />
      <StatTile title="Contributors" value={stats.contributors.toString()} />
      <StatTile title="Issues Open" value={stats.issuesOpen.toString()} />
      <StatTile title="PRs Merged" value={stats.prsMerged.toString()} />
    </section>
  );
}

function StatTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
