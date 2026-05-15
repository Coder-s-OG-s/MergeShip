'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyProfileLinkButton({ profileUrl }: { profileUrl: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Profile link copied' : 'Copy profile link'}
      title={copied ? 'Copied' : 'Copy profile link'}
      className="ml-3 inline-flex items-center align-middle text-zinc-500 transition-colors hover:text-zinc-300"
    >
      {copied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
    </button>
  );
}
