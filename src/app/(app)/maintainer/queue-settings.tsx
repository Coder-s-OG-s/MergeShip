'use client';

import { useState, useTransition } from 'react';
import { setMinContributorLevel, type InstallationSettingsData } from '@/app/actions/maintainer';

const LEVELS = [0, 1, 2, 3] as const;

export default function QueueSettings({ settings }: { settings: InstallationSettingsData }) {
  const [minLevel, setMinLevel] = useState(settings.minContributorLevel);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeMinLevel(next: 0 | 1 | 2 | 3) {
    const previous = minLevel;
    setMinLevel(next);
    setError(null);

    startTransition(async () => {
      const res = await setMinContributorLevel({
        installationId: settings.installationId,
        minContributorLevel: next,
      });

      if (!res.ok) {
        setMinLevel(previous);
        setError(res.error.message);
        return;
      }

      setMinLevel(res.data.minContributorLevel);
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Queue Settings</h2>
          <p className="mt-1 text-xs text-zinc-500">Who enters the review queue automatically.</p>
        </div>

        <fieldset className="min-w-[224px]" disabled={isPending}>
          <legend className="sr-only">Minimum contributor level</legend>
          <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-zinc-800">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={minLevel === level}
                onClick={() => changeMinLevel(level)}
                className={`h-9 border-r border-zinc-800 px-3 text-sm last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                  minLevel === level
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                L{level}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
