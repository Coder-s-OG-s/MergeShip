'use client';

import { useState } from 'react';
import { exportAnalyticsReport } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';

export function ExportReportButton({
  installationId,
  range,
  orgLogin,
}: {
  installationId: number;
  range: AnalyticsRange;
  orgLogin: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await exportAnalyticsReport(installationId, range);
      if (isOk(res)) {
        if (!res.data) {
          alert('No data to export for this installation.');
          return;
        }
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `analytics-${orgLogin}-${range}-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(res.error.message || 'Failed to export report');
      }
    } catch (e) {
      console.error(e);
      alert('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-[#2d333b] px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
    >
      {loading ? 'Exporting...' : 'Export report ↓'}
    </button>
  );
}

export default ExportReportButton;
