'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveFlaggedAccount } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function ResolveFlagButton({
  flagId,
  installationId,
}: {
  flagId: number;
  installationId: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleResolve() {
    setLoading(true);
    try {
      const res = await resolveFlaggedAccount(flagId, 'dismissed', installationId);
      if (isOk(res)) {
        router.refresh();
      } else {
        alert(res.error.message);
        setLoading(false);
      }
    } catch (e) {
      alert('Failed to dismiss flag');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="rounded bg-amber-900/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/60 disabled:opacity-50"
    >
      {loading ? 'Dismissing...' : 'Dismiss'}
    </button>
  );
}
