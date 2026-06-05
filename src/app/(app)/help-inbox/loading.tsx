export default function HelpInboxPageLoading() {
  return (
    <div className="app-page">
      <div className="mx-auto max-w-3xl animate-pulse">
        <div>
          <div className="h-9 w-44 rounded bg-zinc-800" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded bg-zinc-800/40" />
            <div className="h-4 w-2/3 rounded bg-zinc-800/40" />
          </div>
        </div>

        <ul className="mt-6 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-start gap-4 p-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-800/60" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <div className="h-4 w-24 rounded bg-zinc-800/70" />
                  <div className="h-3.5 w-6 rounded bg-zinc-800/40" />
                  <div className="h-3.5 w-32 rounded bg-zinc-800/30" />
                </div>

                <div className="mt-2.5 h-4 w-5/6 rounded bg-zinc-800/50" />

                <div className="mt-3 h-4 w-1/2 rounded bg-zinc-800/30" />
              </div>

              <div className="h-7 w-28 shrink-0 rounded-lg bg-zinc-800/50" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
