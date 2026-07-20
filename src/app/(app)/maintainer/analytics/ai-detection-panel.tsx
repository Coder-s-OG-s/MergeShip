'use client';

import { ShieldAlert, Settings } from 'lucide-react';
import Link from 'next/link';
import type { AiDetectionBreakdown } from '@/app/actions/maintainer/analytics';

const REASON_LABELS: { key: keyof AiDetectionBreakdown['byReason']; label: string }[] = [
  { key: 'largeDiff', label: 'Large Diff' },
  { key: 'generatedMsg', label: 'Generated Msg' },
  { key: 'newAccount', label: 'New Account' },
  { key: 'suspiciousIp', label: 'Suspicious IP' },
];

export function AiDetectionPanel({
  data,
  disabled,
}: {
  data: AiDetectionBreakdown | null;
  disabled?: boolean;
}) {
  if (disabled || !data) {
    return (
      <div
        id="ai-detection-panel-disabled"
        className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-5"
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Settings className="h-8 w-8 text-zinc-500" />
          <p className="text-sm text-zinc-400">
            Enable AI Detection in Settings to see this panel.
          </p>
          <Link
            href="/settings"
            className="text-sm font-medium text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(
    ...REASON_LABELS.map((r) => data.byReason[r.key]),
    1, // prevent division by zero
  );

  return (
    <div
      id="ai-detection-panel"
      className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            AI Detection
          </span>
        </div>
        <span className="text-lg font-bold text-amber-200">
          {data.total}{' '}
          <span className="text-sm font-normal text-amber-400/80">Submissions Blocked</span>
        </span>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3">
        {REASON_LABELS.map(({ key, label }) => {
          const count = data.byReason[key];
          const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{label}</span>
                <span className="font-medium text-zinc-200">{count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
