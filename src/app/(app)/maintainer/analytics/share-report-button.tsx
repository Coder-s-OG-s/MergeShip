'use client';

import { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { createReportSnapshot } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';

interface ShareReportButtonProps {
  installationId: number;
  range: AnalyticsRange;
}

export function ShareReportButton({ installationId, range }: ShareReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setLoading(true);
    setError(null);
    try {
      const res = await createReportSnapshot(installationId, range);
      if (isOk(res)) {
        const fullUrl =
          typeof window !== 'undefined' ? `${window.location.origin}${res.data.url}` : res.data.url;
        setUrl(fullUrl);
      } else {
        setError(res.error.message || 'Failed to create share link');
      }
    } catch (e) {
      console.error(e);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — URL is still visible/selectable in the modal
    }
  }

  function closeModal() {
    setUrl(null);
    setError(null);
    setCopied(false);
  }

  return (
    <>
      <button
        onClick={handleShare}
        disabled={loading}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[#30363d] bg-[#21262d] px-3.5 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-[#30363d] hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
      >
        <span>{loading ? 'Generating...' : 'Share report'}</span>
        <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
      </button>

      {(url || error) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-lg border border-[#2d333b] bg-[#0d1117] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {error ? (
              <>
                <div className="mb-4 text-sm text-rose-400">{error}</div>
                <button
                  onClick={closeModal}
                  className="w-full rounded-md border border-[#2d333b] px-3 py-2 text-sm text-zinc-300"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="mb-2 text-sm font-medium text-zinc-100">Shareable report link</div>
                <div className="mb-4 text-xs text-zinc-500">
                  Anyone with this link can view a read-only snapshot of this report. It expires in
                  30 days.
                </div>
                <div className="mb-4 flex items-center gap-2 rounded-md border border-[#2d333b] bg-black/30 px-3 py-2">
                  <span className="flex-1 truncate text-sm text-zinc-300">{url}</span>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-medium text-black hover:bg-emerald-400"
                  >
                    {copied ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3 w-3" /> Copied
                      </span>
                    ) : (
                      'Copy'
                    )}
                  </button>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full rounded-md border border-[#2d333b] px-3 py-2 text-sm text-zinc-300"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ShareReportButton;
