'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MaintainerAnalyticsTrends } from '@/lib/maintainer/analytics';

export default function AnalyticsTrends({ data }: { data: MaintainerAnalyticsTrends }) {
  const hasWeeklyData = data.weekly.some((row) => row.mergedPrs > 0 || row.xpDistributed > 0);
  const hasLevelData = data.levelDistribution.some(
    (row) => row.l0 > 0 || row.l1 > 0 || row.l2 > 0 || row.l3Plus > 0,
  );

  return (
    <section className="mb-8 grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Weekly Merge Rate</h2>
          <span className="text-xs text-zinc-500">12 weeks</span>
        </div>
        {hasWeeklyData ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(63,63,70,0.35)' }}
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                    color: '#fafafa',
                  }}
                />
                <Legend wrapperStyle={{ color: '#d4d4d8', fontSize: 12 }} />
                <Bar dataKey="mergedPrs" name="Merged PRs" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="xpDistributed"
                  name="XP distributed"
                  fill="#60a5fa"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart label="No merged PR or XP activity in this window." />
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Level Distribution</h2>
          <span className="text-xs text-zinc-500">6 months</span>
        </div>
        {hasLevelData && data.levelDistribution.length > 0 ? (
          <LevelDistributionBar
            current={data.levelDistribution[data.levelDistribution.length - 1]!}
          />
        ) : (
          <EmptyChart label="No contributor levels available for these repositories." />
        )}
      </div>
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
      {label}
    </div>
  );
}

function LevelDistributionBar({
  current,
}: {
  current: { l0: number; l1: number; l2: number; l3Plus: number };
}) {
  const total = current.l0 + current.l1 + current.l2 + current.l3Plus;
  const segments = [
    { key: 'l1', label: 'L1', value: current.l1, color: '#fbbf24' },
    { key: 'l2', label: 'L2', value: current.l2, color: '#38bdf8' },
    { key: 'l3Plus', label: 'L3+', value: current.l3Plus, color: '#a78bfa' },
  ];

  return (
    <div className="flex h-72 flex-col justify-center gap-4">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-zinc-800">
        {segments.map((segment) => {
          const pct = total > 0 ? (segment.value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={segment.key}
              style={{ width: `${pct}%`, backgroundColor: segment.color }}
              className="h-full"
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {segments.map((segment) => {
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div key={segment.key} className="flex items-center gap-2 text-sm text-zinc-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label} ({pct}%)
            </div>
          );
        })}
      </div>
    </div>
  );
}
