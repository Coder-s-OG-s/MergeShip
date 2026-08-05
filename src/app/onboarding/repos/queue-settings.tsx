'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import {
  setAiPrDetection,
  setAutoAssignMentorChain,
  setMinContributorLevel,
} from '@/app/actions/maintainer';
import type { InstallationSettingsData } from '@/app/actions/maintainer/types';

export function QueueSettings({
  installationId,
  initialSettings,
}: {
  installationId: number;
  initialSettings: InstallationSettingsData;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [, startTransition] = useTransition();

  function toggleAiDetection() {
    const next = !settings.aiPrDetection;
    const prev = settings.aiPrDetection;
    setSettings((s) => ({ ...s, aiPrDetection: next }));
    startTransition(async () => {
      const res = await setAiPrDetection({ installationId, enabled: next });
      if (!res.ok) setSettings((s) => ({ ...s, aiPrDetection: prev }));
    });
  }

  function toggleMentorChain() {
    const next = !settings.autoAssignMentorChain;
    const prev = settings.autoAssignMentorChain;
    setSettings((s) => ({ ...s, autoAssignMentorChain: next }));
    startTransition(async () => {
      const res = await setAutoAssignMentorChain({ installationId, enabled: next });
      if (!res.ok) setSettings((s) => ({ ...s, autoAssignMentorChain: prev }));
    });
  }

  function changeMinLevel(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = parseInt(e.target.value, 10) as 0 | 1 | 2 | 3;
    const prev = settings.minContributorLevel;
    setSettings((s) => ({ ...s, minContributorLevel: next }));
    startTransition(async () => {
      const res = await setMinContributorLevel({ installationId, minContributorLevel: next });
      if (!res.ok) setSettings((s) => ({ ...s, minContributorLevel: prev }));
    });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Queue Settings</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Configure how incoming PRs and contributors are handled by the queue.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Min Contributor Level */}
        <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <label htmlFor="min-level" className="text-sm font-medium text-white">
            Minimum Contributor Level
          </label>
          <p className="mb-2 text-xs text-zinc-500">
            The minimum trust level required to open PRs in these repositories.
          </p>
          <select
            id="min-level"
            value={settings.minContributorLevel}
            onChange={changeMinLevel}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-neon-green/50 focus:outline-none"
          >
            <option value={0}>Level 0 (All Contributors)</option>
            <option value={1}>Level 1 (Verified)</option>
            <option value={2}>Level 2 (Trusted)</option>
            <option value={3}>Level 3 (Core)</option>
          </select>
        </div>

        {/* AI PR Detection */}
        <button
          type="button"
          onClick={toggleAiDetection}
          className={`flex w-full items-start gap-3 rounded-md border px-4 py-4 text-left transition-colors ${
            settings.aiPrDetection
              ? 'border-neon-green/40 bg-neon-green/[0.06]'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              settings.aiPrDetection
                ? 'border-neon-green bg-neon-green text-black'
                : 'border-zinc-600 bg-transparent'
            }`}
          >
            {settings.aiPrDetection && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-white">AI-Generated PR Detection</span>
            <span className="text-xs text-zinc-500">
              Automatically flag pull requests that appear to be heavily LLM-generated.
            </span>
          </div>
        </button>

        {/* Auto-Assign Mentor Chain */}
        <button
          type="button"
          onClick={toggleMentorChain}
          className={`flex w-full items-start gap-3 rounded-md border px-4 py-4 text-left transition-colors ${
            settings.autoAssignMentorChain
              ? 'border-neon-green/40 bg-neon-green/[0.06]'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              settings.autoAssignMentorChain
                ? 'border-neon-green bg-neon-green text-black'
                : 'border-zinc-600 bg-transparent'
            }`}
          >
            {settings.autoAssignMentorChain && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-white">Auto-Assign Mentor Chain</span>
            <span className="text-xs text-zinc-500">
              Automatically assign L2/L3 mentors to new PRs from L0/L1 contributors.
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
