export default function LeaderboardPageLoading() {
  return (
    <div className="app-page">
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="h-9 w-44 rounded bg-zinc-800" />

        <nav className="mt-5 flex flex-wrap gap-2">
          <div className="h-7 w-16 rounded-lg bg-zinc-800" />
          <div className="h-7 w-20 rounded-lg bg-zinc-800/40" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800/40" />
          <div className="h-7 w-16 rounded-lg bg-zinc-800/40" />
        </nav>

        <ul className="mt-6 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="flex items-center gap-4 p-4">
              <div className="h-4 w-8 shrink-0 rounded bg-zinc-800/40" />

              <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-800/60" />

              <div className="flex flex-1 items-baseline gap-2">
                <div className="h-4 w-32 rounded bg-zinc-800/70" />
                <div className="h-3.5 w-24 rounded bg-zinc-800/30" />
              </div>

              <div className="h-4 w-10 rounded bg-zinc-800/40" />

              <div className="h-4 w-20 shrink-0 rounded bg-zinc-800/50" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
