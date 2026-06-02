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
        {hasLevelData ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.levelDistribution}
                margin={{ left: -24, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                    color: '#fafafa',
                  }}
                />
                <Legend wrapperStyle={{ color: '#d4d4d8', fontSize: 12 }} />
                <Area dataKey="l0" name="L0" stackId="levels" stroke="#f87171" fill="#7f1d1d" />
                <Area dataKey="l1" name="L1" stackId="levels" stroke="#fbbf24" fill="#713f12" />
                <Area dataKey="l2" name="L2" stackId="levels" stroke="#38bdf8" fill="#075985" />
                <Area
                  dataKey="l3Plus"
                  name="L3+"
                  stackId="levels"
                  stroke="#a78bfa"
                  fill="#4c1d95"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
