export default function LeaderboardPageLoading() {
  return (
    <div className="app-page">
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="h-9 w-44 rounded bg-zinc-800" />

      {/* Main skeleton */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-zinc-800/60" />
          <div className="mb-2 h-8 w-48 animate-pulse rounded bg-zinc-800" />
          <div className="mb-8 h-4 w-36 animate-pulse rounded bg-zinc-800/60" />

          <div className="mb-8 h-10 animate-pulse rounded-xl bg-zinc-900/50" />

          <div className="mb-10 flex items-end justify-center gap-4">
            <div className="h-36 w-36 animate-pulse rounded-t-2xl bg-zinc-900/80" />
            <div className="h-44 w-36 animate-pulse rounded-t-2xl bg-zinc-900/80" />
            <div className="h-28 w-36 animate-pulse rounded-t-2xl bg-zinc-900/80" />
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-8 animate-pulse rounded bg-zinc-800/60" />
                <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-800/80" />
                <div className="h-4 flex-1 animate-pulse rounded bg-zinc-800/70" />
                <div className="h-4 w-16 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-4 w-10 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-4 w-10 animate-pulse rounded bg-zinc-800/50" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar skeleton */}
      <aside className="hidden w-72 shrink-0 flex-col gap-6 border-l border-zinc-800 p-6 xl:flex">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="mb-3 h-3 w-20 animate-pulse rounded bg-zinc-800/60" />
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-800/70" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800/50" />
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
