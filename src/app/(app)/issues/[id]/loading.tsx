export default function IssueDetailLoading() {
  return (
    <div className="min-h-screen bg-[#0D0E12] font-mono text-white">
      {/* Breadcrumbs */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-12 rounded bg-zinc-800" />
            <div className="h-3 w-2 rounded bg-zinc-800/50" />
            <div className="h-3 w-24 rounded bg-zinc-800" />
            <div className="h-3 w-2 rounded bg-zinc-800/50" />
            <div className="h-3 w-8 rounded bg-zinc-800" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-28 rounded bg-zinc-800" />
            <div className="ml-auto h-8 w-32 rounded border border-zinc-800 bg-zinc-900/30" />
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr_280px]">
          {/* Left sidebar */}
          <div className="hidden animate-pulse lg:block">
            <div className="h-12 w-full rounded border border-zinc-800 bg-zinc-900/30" />
            <div className="mt-6 space-y-2 border-t border-zinc-800 pt-4">
              <div className="h-8 w-full rounded bg-zinc-900/20" />
              <div className="h-8 w-full rounded bg-zinc-900/20" />
              <div className="h-8 w-full rounded bg-zinc-900/20" />
            </div>
          </div>

          {/* Main content */}
          <div className="min-w-0 animate-pulse">
            {/* Header card */}
            <div className="mb-8 border border-zinc-800 bg-[#131520] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-5 w-16 rounded border border-zinc-800 bg-zinc-900/30" />
                <div className="h-5 w-20 rounded border border-zinc-800 bg-zinc-900/30" />
                <div className="h-5 w-12 rounded bg-emerald-900/20" />
                <div className="h-5 w-12 rounded bg-zinc-900/20" />
              </div>
              <div className="mb-3 h-8 w-3/4 rounded bg-zinc-800" />
              <div className="flex gap-4">
                <div className="h-3 w-20 rounded bg-zinc-800/50" />
                <div className="h-3 w-16 rounded bg-zinc-800/50" />
                <div className="h-3 w-24 rounded bg-zinc-800/50" />
              </div>
            </div>

            {/* Content sections */}
            <div className="mb-8 space-y-6">
              <div className="border border-zinc-800 p-6">
                <div className="mb-4 h-3 w-24 rounded bg-zinc-800" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-zinc-800/40" />
                  <div className="h-3 w-5/6 rounded bg-zinc-800/40" />
                  <div className="h-3 w-2/3 rounded bg-zinc-800/40" />
                </div>
              </div>
            </div>

            {/* Code block */}
            <div className="mb-8 border border-zinc-800 p-6">
              <div className="mb-4 h-3 w-20 rounded bg-zinc-800" />
              <div className="h-48 w-full rounded border border-zinc-800 bg-[#080810]" />
            </div>

            {/* Discussion */}
            <div className="border border-zinc-800 p-6">
              <div className="mb-6 h-3 w-20 rounded bg-zinc-800" />
              <div className="space-y-5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 border-b border-zinc-800/50 pb-5 last:border-0"
                  >
                    <div className="h-8 w-8 shrink-0 bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-zinc-800" />
                      <div className="h-3 w-full rounded bg-zinc-800/40" />
                      <div className="h-3 w-4/5 rounded bg-zinc-800/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="animate-pulse">
            <div className="border border-zinc-800 bg-[#111320] p-5">
              <div className="mb-5 h-3 w-28 rounded bg-zinc-800" />
              <div className="mb-4 h-10 w-full rounded bg-zinc-900/30" />
              <div className="mb-5 h-10 w-full rounded bg-zinc-900/30" />
              <div className="h-12 w-full rounded border border-zinc-800 bg-zinc-900/20" />
              <div className="mt-4 h-8 w-full rounded bg-zinc-800/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
