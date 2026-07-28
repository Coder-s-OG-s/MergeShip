import { ShieldCheck } from 'lucide-react';
import { buildTrustSegments } from '@/lib/maintainer/trust';

type Props = {
  segments: ReturnType<typeof buildTrustSegments>;
  total: number;
};

export function TrustSegmentsPanel({ segments, total }: Props) {
  const maxCount = Math.max(
    segments['80-100'],
    segments['60-79'],
    segments['40-59'],
    segments['0-39'],
    0,
  );

  const rows = [
    {
      label: '80-100',
      count: segments['80-100'],
      color: 'bg-emerald-500',
    },
    {
      label: '60-79',
      count: segments['60-79'],
      color: 'bg-emerald-400',
    },
    {
      label: '40-59',
      count: segments['40-59'],
      color: 'bg-amber-500',
    },
    {
      label: '0-39',
      count: segments['0-39'],
      color: 'bg-rose-500',
    },
  ];

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md">
      <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        <ShieldCheck className="h-4 w-4 text-zinc-400" />
        Trust Segments
      </h2>

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;

          return (
            <div key={row.label} className="flex items-center gap-4">
              <span className="w-14 text-xs font-semibold text-zinc-400">{row.label}</span>

              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${row.color}`}
                  style={{
                    width: `${pct}%`,
                  }}
                />
              </div>

              <span className="w-6 text-right text-xs font-semibold text-zinc-300">
                {row.count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <span>Total Contributors</span>

        <span className="font-semibold text-zinc-400">{total}</span>
      </div>
    </div>
  );
}
