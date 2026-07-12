'use client';

import { useState } from 'react';
import { exportContributorsCsv } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export default function ExportContributorsButton({ installationId }: { installationId: number }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await exportContributorsCsv(installationId);
      if (isOk(res)) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `contributors-${installationId}-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(res.error.message || 'Failed to export CSV');
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
      className="rounded-lg border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
    >
      {loading ? 'Exporting...' : 'Export CSV'}
    </button>
  );
}
