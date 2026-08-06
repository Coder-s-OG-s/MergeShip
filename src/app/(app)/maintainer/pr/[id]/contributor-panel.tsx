import { Award } from 'lucide-react';

/**
 * "Contributor" sidebar panel for the PR detail page — author handle,
 * level, and total-submitted-vs-merged across this install (issue #494).
 *
 * Trust score is left out on purpose: it depends on the composite trust
 * score work (#454) and isn't wired up here.
 */
export function ContributorPanel({
  handle,
  level,
  totalPrs,
  mergedPrs,
}: {
  handle: string;
  level: number;
  totalPrs: number;
  mergedPrs: number;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        <Award className="h-4 w-4 text-amber-400" />
        Contributor
      </h2>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-zinc-300">
          L{level}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">@{handle}</p>
          <p className="text-xs text-zinc-500">
            {totalPrs} PRs · {mergedPrs} Merged
          </p>
        </div>
      </div>
    </div>
  );
}
