'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CopyProfileLinkButtonProps = {
  profileUrl: string;
};

export function CopyProfileLinkButton({ profileUrl }: CopyProfileLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator?.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);

      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      resetTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Ignore clipboard errors to keep UI stable.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Profile link copied' : 'Copy profile link'}
      title={copied ? 'Copied' : 'Copy profile link'}
      className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[#30363d] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39d353]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
