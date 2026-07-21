'use client';

import { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';

interface ShareReportButtonProps {
  installationId?: number;
  range?: AnalyticsRange;
}

export function ShareReportButton({ installationId, range }: ShareReportButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const url = new URL(window.location.href);
      if (installationId) {
        url.searchParams.set('install', installationId.toString());
      }
      if (range) {
        url.searchParams.set('range', range);
      }
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[#30363d] bg-[#21262d] px-3.5 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-[#30363d] hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-400" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <span>Share report</span>
          <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
        </>
      )}
    </button>
  );
}

export default ShareReportButton;
