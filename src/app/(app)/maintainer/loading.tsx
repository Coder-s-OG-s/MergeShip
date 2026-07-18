export default function MaintainerPageLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl animate-pulse">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <div className="h-9 w-40 rounded bg-zinc-800" />
          <div className="h-9 w-28 rounded-lg border border-zinc-700 bg-zinc-800/30" />
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="h-6 w-12 rounded-lg bg-zinc-800" />
          <div className="h-6 w-14 rounded-lg bg-zinc-800/40" />
          <div className="h-6 w-14 rounded-lg bg-zinc-800/40" />

          <span className="px-1 text-zinc-800">|</span>

          <div className="h-6 w-16 rounded-lg bg-zinc-800/40" />
          <div className="h-6 w-20 rounded-lg bg-zinc-800/40" />
          <div className="h-6 w-10 rounded-lg bg-zinc-800/40" />

          <div className="ml-auto flex gap-2">
            <div className="h-7 w-24 rounded-lg border border-zinc-700 bg-zinc-800/20" />
            <div className="h-7 w-32 rounded-lg border border-zinc-700 bg-zinc-800/20" />
          </div>
        </div>

        <div className="mb-4 h-3.5 w-48 rounded bg-zinc-800/30" />

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-4 h-4 w-28 rounded bg-zinc-800" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-24 rounded bg-zinc-800/70" />
                    <div className="h-2.5 w-16 rounded bg-zinc-800/30" />
                  </div>
                  <div className="h-5 w-10 rounded-full bg-zinc-800/40" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-4 h-4 w-20 rounded bg-zinc-800" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0">
                  <div className="mb-1.5 flex justify-between gap-2">
                    <div className="h-3.5 flex-1 rounded bg-zinc-800/70" />
                    <div className="h-3 w-8 shrink-0 rounded bg-zinc-800/40" />
                  </div>
                  <div className="h-2.5 w-20 rounded bg-zinc-800/30" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-4 h-4 w-28 rounded bg-zinc-800" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0"
                >
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-16 rounded bg-zinc-800/70" />
                    <div className="h-2.5 w-12 rounded bg-zinc-800/30" />
                  </div>
                  <div className="h-3.5 w-12 rounded bg-zinc-800/40" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          {[1, 2].map((i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="h-5 w-48 rounded bg-zinc-800/80" />
                  <div className="h-3.5 w-36 rounded bg-zinc-800/40" />
                  <div className="h-4.5 w-12 rounded-full bg-zinc-800/50" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-3.5 w-16 rounded bg-zinc-800/40" />
                  <div className="h-4.5 w-8 rounded-full bg-zinc-800/60" />
                  <div className="h-3.5 w-24 rounded bg-zinc-800/30" />
                </div>
              </div>

              {i === 1 && (
                <div className="h-5 w-44 shrink-0 rounded-full bg-emerald-900/20 ring-1 ring-emerald-700/30" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
