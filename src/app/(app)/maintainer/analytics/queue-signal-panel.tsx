'use client';

import type { QueueSignalQuality } from '@/app/actions/maintainer';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const SEGMENTS = [
  {
    key: 'mergedAsIs',
    label: 'Merged as-is',
    color: '#10b981',
  },
  {
    key: 'mergedWithEdits',
    label: 'Merged w/ edits',
    color: '#f59e0b',
  },
  {
    key: 'closedRejected',
    label: 'Closed/Rejected',
    color: '#71717a',
  },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]['key'];

type ChartRow = {
  key: SegmentKey;
  name: string;
  value: number;
  percent: number;
  color: string;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function QueueSignalTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-white">{row.name}</div>
      <div className="mt-1 text-zinc-400">
        {row.value} PRs - {formatPercent(row.percent)}
      </div>
    </div>
  );
}

export default function QueueSignalPanel({ data }: { data: QueueSignalQuality }) {
  const rows: ChartRow[] = SEGMENTS.map((segment) => {
    const value = data[segment.key];
    return {
      key: segment.key,
      name: segment.label,
      value,
      percent: data.total > 0 ? (value / data.total) * 100 : 0,
      color: segment.color,
    };
  });

  return (
    <div className="flex min-h-[320px] flex-col rounded-xl border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
          QUEUE SIGNAL QUALITY
        </div>
        <div
          className="cursor-help text-xs text-zinc-500"
          title="Merged w/ edits uses merged PRs without mentor verification as a proxy because close-then-reopen history is not tracked yet."
        >
          Proxy
        </div>
      </div>

      {data.total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-zinc-400">
          No closed PRs in this period
        </div>
      ) : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {rows.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<QueueSignalTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-serif text-4xl text-white">{formatPercent(data.signalRate)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                VALID
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate text-zinc-300">{row.name}</span>
                </div>
                <span className="font-mono text-white">{formatPercent(row.percent)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
