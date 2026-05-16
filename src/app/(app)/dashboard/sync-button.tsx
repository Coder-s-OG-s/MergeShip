'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { syncGitHubStats } from '@/app/actions/github-sync';
import { useToast } from '@/components/toast';

type Props = {
  lastSyncedAt: string | null;
};

export function SyncButton({ lastSyncedAt }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [localSyncedAt, setLocalSyncedAt] = useState(lastSyncedAt);
  const router = useRouter();
  const { addToast } = useToast();

  const handleSync = useCallback(async () => {
    if (syncing || cooldown) return;
    setSyncing(true);
    setError(null);

    const result = await syncGitHubStats();

    setSyncing(false);
    if (result.ok) {
      setLocalSyncedAt(new Date().toISOString());
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60_000);

      // Show sync-complete toast
      const { merges, streak } = result.data;
      addToast(
        merges > 0
          ? `GITHUB SYNCED — ${merges} MERGE${merges !== 1 ? 'S' : ''} · ${streak}D STREAK`
          : 'GITHUB SYNCED',
        'success',
      );

      router.refresh();
    } else {
      setError(result.error.message);
    }
  }, [syncing, cooldown, router, addToast]);

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
  if (mins < 60) return `LAST SYNCED ${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `LAST SYNCED ${hrs}H AGO`;
  return `LAST SYNCED ${Math.floor(hrs / 24)}D AGO`;
}