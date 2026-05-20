export default function MyPRsPageLoading() {
  return (
    <div className="flex min-h-screen bg-[#111318] font-mono text-white">
      <div className="flex-1 animate-pulse overflow-y-auto px-10 py-10">
        <header className="mb-8">
          <div className="h-9 w-64 rounded bg-zinc-800" />
        </header>

        <div className="flex items-end justify-between gap-4 border-b border-[#2d333b]">
          <div className="flex gap-0">
            <div className="relative px-5 py-3">
              <div className="h-3 w-12 rounded bg-zinc-800" />
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#39d353]/60" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-3">
                <div className="h-3 w-20 rounded bg-zinc-800/40" />
              </div>
            ))}
          </div>

          <div className="mb-2 h-8 w-32 rounded-sm border border-[#2d333b] bg-[#1c2128]/50" />
        </div>

        <div className="mb-3 mt-3 h-3 w-32 rounded bg-zinc-800/40" />

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-sm border border-[#2d333b] bg-[#161b22] p-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-6 w-6 rounded-sm border border-[#2d333b] bg-[#1c2128]/60" />
                  <div className="h-4 w-28 rounded bg-zinc-800/50" />
                  <div className="h-5 w-12 rounded bg-zinc-800/30" />
                </div>

                <div className="h-7 w-16 rounded-sm border border-zinc-800 bg-zinc-900/40" />
              </div>

              <div className="mb-4 h-5 w-3/4 rounded bg-zinc-800/60" />

              <div className="h-3.5 w-24 rounded bg-zinc-800/30" />
            </div>
          ))}
        </div>
      </div>

      <aside className="w-[260px] shrink-0 animate-pulse border-l border-[#2d333b] p-6">
        <div className="rounded-sm border border-[#2d333b] bg-[#161b22] p-5">
          <div className="mb-5 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-zinc-800" />
            <div className="h-3.5 w-32 rounded bg-zinc-800/60" />
          </div>

          <div className="mb-5">
            <div className="mb-2 h-2.5 w-16 rounded bg-zinc-800/40" />
            <div className="h-10 w-12 rounded bg-zinc-800/80" />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 h-2.5 w-16 rounded bg-zinc-800/40" />
              <div className="h-7 w-10 rounded bg-zinc-800/70" />
            </div>
            <div>
              <div className="mb-2 h-2.5 w-16 rounded bg-zinc-800/40" />
              <div className="h-7 w-14 rounded bg-zinc-800/70" />
            </div>
          </div>

          <div className="mb-5 border-t border-[#2d333b] pt-5">
            <div className="mb-2 h-2.5 w-24 rounded bg-zinc-800/40" />
            <div className="h-6 w-20 rounded bg-zinc-800/60" />
          </div>

          <div className="border-t border-[#2d333b] pt-5">
            <div className="mb-2 flex justify-between">
              <div className="h-3 w-6 rounded bg-zinc-800/40" />
              <div className="h-3 w-24 rounded bg-zinc-800/40" />
            </div>
            <div className="h-2 w-full rounded-full bg-[#1c2128]" />
          </div>
        </div>

        <div className="mt-4 rounded-sm border border-[#2d333b] bg-[#161b22] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-sm bg-zinc-800/70" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-20 rounded bg-zinc-800/60" />
              <div className="h-2.5 w-24 rounded bg-zinc-800/30" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
