import { buildCurrentLevelSnapshot } from '@/lib/maintainer/analytics';
import { Award } from 'lucide-react';

type ContributorLike = {
  level: number;
};

export function LevelDistributionPanel({ contributors }: { contributors: ContributorLike[] }) {
  const snapshot = buildCurrentLevelSnapshot(contributors);
  const total = contributors.length;

  const maxCount = Math.max(snapshot.l0, snapshot.l1, snapshot.l2, snapshot.l3Plus);

  const rows = [
    { label: 'L3+', count: snapshot.l3Plus, color: 'bg-amber-500' },
    { label: 'L2', count: snapshot.l2, color: 'bg-violet-500' },
    { label: 'L1', count: snapshot.l1, color: 'bg-emerald-500' },
    { label: 'L0', count: snapshot.l0, color: 'bg-zinc-600' },
  ];

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md">
      <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        <Award className="h-4 w-4 text-zinc-400" />
        Level Distribution
      </h2>

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
          return (
            <div key={row.label} className="flex items-center gap-4">
              <span className="w-8 text-xs font-semibold text-zinc-400">{row.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${row.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs font-semibold text-zinc-300">
                {row.count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-zinc-850 mt-6 flex justify-between border-t pt-4 text-xs text-zinc-500">
        <span>Total Contributors</span>
        <span className="font-semibold text-zinc-400">{total}</span>
      </div>
    </div>
  );
}
