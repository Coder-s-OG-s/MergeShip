'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { syncGitHubStats } from '@/app/actions/github-sync';

type Props = {
  lastSyncedAt: string | null;
  userId: string;
};

export function SyncButton({ lastSyncedAt, userId }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [localSyncedAt, setLocalSyncedAt] = useState(lastSyncedAt);

  const router = useRouter();

  const handleSync = useCallback(async () => {
    if (syncing || cooldown) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await syncGitHubStats();

      if (!result.ok) {
        setSyncing(false);
        setError(result.error?.message || 'Sync failed');
        return;
      }

      setCooldown(true);

      setTimeout(() => {
        setCooldown(false);
      }, 60_000);

      const start = Date.now();

      const interval = setInterval(async () => {
        try {
          // timeout after 60s
          if (Date.now() - start > 60_000) {
            clearInterval(interval);
            setSyncing(false);
            setError('Sync timeout. Please try again.');
            return;
          }

          const res = await fetch(`/api/sync-status?userId=${userId}`);

          if (!res.ok) {
            clearInterval(interval);
            setSyncing(false);
            setError('Failed to fetch sync status');
            return;
          }

          const data = await res.json();

          console.log('SYNC STATUS:', data);

          if (data.status === 'completed') {
            clearInterval(interval);

            setLocalSyncedAt(new Date().toISOString());

            router.refresh();

            setSyncing(false);
          }
        } catch (err) {
          clearInterval(interval);
          setSyncing(false);
          setError('Failed checking sync status');
        }
      }, 2000);
    } catch (err) {
      setSyncing(false);
      setError('Something went wrong');
    }
  }, [syncing, cooldown, router, userId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={syncing || cooldown}
        className="flex items-center gap-2 border border-zinc-700 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />

        {syncing ? 'SYNCING...' : 'SYNC'}
      </button>

      <span className="text-[10px] uppercase tracking-widest text-zinc-600">
        {formatSyncedAt(localSyncedAt)}
      </span>

      {error && (
        <span className="max-w-[200px] text-right text-[10px] uppercase tracking-widest text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'NEVER SYNCED';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) {
    return `LAST SYNCED ${mins}M AGO`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `LAST SYNCED ${hrs}H AGO`;
  }
  return `LAST SYNCED ${Math.floor(hrs / 24)}D AGO`;
}
