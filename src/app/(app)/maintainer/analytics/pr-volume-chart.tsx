'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PrVolumeDataPoint } from '@/app/actions/maintainer';

export default function PrVolumeChart({ data }: { data: PrVolumeDataPoint[] }) {
  const hasData = data.some((d) => d.opened > 0 || d.merged > 0 || d.closed > 0 || d.aiBlocked > 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">PR Volume</h2>
        <span className="text-xs text-zinc-500">merged / AI blocked / stalled</span>
      </div>
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                tickLine={false}
                tickFormatter={(v: string) => {
                  const d = new Date(v + 'T00:00:00Z');
                  return d.toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  });
                }}
              />
              <YAxis
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(63,63,70,0.35)' }}
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  color: '#fafafa',
                }}
                labelFormatter={(v: string) => {
                  const d = new Date(v + 'T00:00:00Z');
                  return d.toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  });
                }}
              />
              <Legend wrapperStyle={{ color: '#d4d4d8', fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="merged"
                name="Merged"
                stroke="#34d399"
                fill="#34d399"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="aiBlocked"
                name="AI Blocked"
                stroke="#f87171"
                fill="#f87171"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="closed"
                name="Stalled"
                stroke="#fbbf24"
                fill="#fbbf24"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
          No data for this period.
        </div>
      )}
    </div>
  );
}
