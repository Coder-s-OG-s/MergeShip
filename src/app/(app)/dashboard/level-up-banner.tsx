'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getUnacknowledgedLevelUps,
  acknowledgeLevelUp,
  type LevelUpRow,
} from '@/app/actions/level-ups';
import { useToast } from '@/components/toast';


export default function LevelUpBanner() {
  const [rows, setRows] = useState<LevelUpRow[]>([]);
  const [, startTransition] = useTransition();
  const { addToast } = useToast();

  useEffect(() => {
    let live = true;
    (async () => {
      const res = await getUnacknowledgedLevelUps();
      if (!live || !res.ok) return;

      const levelUps = res.data;
      setRows(levelUps);

      
      levelUps.forEach((row, i) => {
        setTimeout(() => {
          addToast(`⬆ LEVEL UP — YOU ARE NOW L${row.toLevel}`, 'level-up');
        }, i * 400);
      });
    })();
    return () => {
      live = false;
    };
  
  }, []);
  

  if (rows.length === 0) return null;
  const top = rows[0]!;

  function dismiss(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => {
      void (async () => {
        await acknowledgeLevelUp(id);
      })();
    });
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 border border-emerald-700/50 bg-emerald-900/30 px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="font-serif text-2xl text-emerald-300">
          L{top.fromLevel} → L{top.toLevel}
        </div>
        <div className="text-sm text-emerald-100">
          You leveled up. Higher-tier issues are now unlocked.
          {rows.length > 1 && (
            <span className="ml-2 text-emerald-400/80">(+{rows.length - 1} more)</span>
          )}
        </div>
      </div>
      <button
        onClick={() => dismiss(top.id)}
        className="rounded-md border border-emerald-700/60 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-900/50"
      >
        Got it
      </button>
    </div>
  );
}