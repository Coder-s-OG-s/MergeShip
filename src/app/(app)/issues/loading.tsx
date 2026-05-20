export default function IssuesPageLoading() {
  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl animate-pulse">
        <header className="mb-12 border-b border-[#2d333b] pb-6">
          <div className="mb-4 h-3 w-24 rounded bg-zinc-800" />
          <div className="h-9 w-64 rounded bg-zinc-800" />
        </header>

        <div className="mb-10 flex flex-wrap items-center gap-3">
          <div className="h-10 min-w-[180px] flex-1 rounded border border-[#2d333b] bg-[#161b22]/40" />

          <div className="h-10 w-32 rounded border border-[#2d333b] bg-[#161b22]/40" />
          <div className="h-10 w-24 rounded border border-[#2d333b] bg-[#161b22]/40" />

          <div className="flex items-center gap-2 px-2">
            <div className="h-3.5 w-3.5 rounded-sm border border-zinc-700 bg-zinc-900" />
            <div className="h-3 w-24 rounded bg-zinc-800/40" />
          </div>
        </div>

        <div className="mb-10 h-3 w-20 rounded bg-zinc-800/40" />

        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-[#2d333b] py-8 last:border-0">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-5 w-12 rounded border border-zinc-800 bg-zinc-900/30 text-center" />
                  <span className="text-xs text-zinc-800">/</span>
                  <div className="h-5 w-24 rounded border border-zinc-800 bg-zinc-900/30" />
                  <div className="h-5 w-8 rounded border border-zinc-800 bg-zinc-900/40" />
                </div>
                <div className="h-3 w-12 rounded bg-zinc-800/20" />
              </div>

              <div className="mb-4 h-7 w-2/3 rounded bg-zinc-800/60" />

              <div className="mb-5 flex flex-wrap gap-2">
                <div className="h-5 w-20 rounded border border-[#2d333b] bg-zinc-900/10" />
                <div className="h-5 w-16 rounded border border-[#2d333b] bg-zinc-900/10" />
              </div>

              <div className="flex items-center gap-4">
                <div className="h-8 w-28 rounded border border-zinc-700 bg-zinc-900/20" />
                <div className="h-4 w-12 rounded bg-zinc-800/30" />
                <div className="ml-auto h-4 w-14 rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
