'use client';

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
} from 'recharts';
import type { PrVolumeBucket } from '@/app/actions/maintainer/analytics';

export function PrVolumeChart({ data }: { data: PrVolumeBucket[] }) {
  const hasData = data.some((row) => row.merged > 0 || row.aiBlocked > 0 || row.stalled > 0);

  return (
    <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">PR Volume</h2>
      </div>
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} />
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
              />
              <Legend wrapperStyle={{ color: '#d4d4d8', fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="merged"
                name="Merged"
                fill="#10b981"
                fillOpacity={0.2}
                stroke="#10b981"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="aiBlocked"
                name="AI Blocked"
                stroke="#f87171"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="stalled"
                name="Stalled"
                stroke="#71717a"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
          No data for this period
        </div>
      )}
    </div>
  );
}
