import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function IssuesLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-24 bg-zinc-800/40" />
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-lg bg-zinc-800/40" />
          ))}
        </div>

        <SkeletonText className="mb-4 h-3 w-48 bg-zinc-800/30" />

        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Skeleton className="h-5 w-56 bg-zinc-800/80" />
                  <Skeleton className="h-3.5 w-32 bg-zinc-800/40" />
                  <Skeleton className="h-5 w-20 rounded-full bg-zinc-800/50" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-3.5 w-24 bg-zinc-800/40" />
                  <Skeleton className="h-3.5 w-28 bg-zinc-800/30" />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-4 w-14 rounded bg-zinc-800/30" />
                  <Skeleton className="h-4 w-12 rounded bg-zinc-800/30" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
