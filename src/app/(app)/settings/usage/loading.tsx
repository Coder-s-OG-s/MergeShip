export default function UsagePageLoading() {
  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="mb-4 h-3 w-32 rounded bg-zinc-800/50" />

        <div className="mb-2 h-9 w-44 rounded bg-zinc-800" />

        <div className="mb-8 space-y-2">
          <div className="h-3.5 w-full rounded bg-zinc-800/40" />
          <div className="h-3.5 w-2/3 rounded bg-zinc-800/40" />
        </div>

        <div className="mb-10 grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-sm border border-[#21262d] bg-[#161b22] p-5">
              <div className="mb-2 h-2.5 w-20 rounded bg-zinc-800/50" />
              <div className="h-8 w-10 rounded bg-[#39d353]/20" />
            </div>
          ))}
        </div>

        <div className="mb-3 h-3 w-28 rounded bg-zinc-800/50" />

        <div className="rounded-sm border border-[#21262d] bg-[#161b22]">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[#21262d] p-4 last:border-0"
            >
              <div className="h-4 w-32 shrink-0 rounded bg-zinc-800/60" />

              <div className="h-3.5 flex-1 rounded bg-zinc-800/30" />

              <div className="h-3 w-36 shrink-0 rounded bg-zinc-800/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
