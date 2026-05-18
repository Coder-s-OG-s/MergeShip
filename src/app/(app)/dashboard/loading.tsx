// src/app/(app)/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl animate-pulse">
        {/* Top Notification Banner Skeleton */}
        <div className="mb-6 flex items-center justify-between gap-4 border border-zinc-800/40 bg-zinc-900/20 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="h-6 w-24 bg-zinc-800/50" />
            <div className="h-4 w-64 bg-zinc-800/30" />
          </div>
          <div className="h-6 w-16 rounded bg-zinc-800/40" />
        </div>

        {/* Dashboard Header Skeleton */}
        <header className="mb-12 flex flex-col justify-between gap-6 border-b border-[#2d333b] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 h-3 w-28 bg-zinc-800/30" />
            <div className="h-9 w-72 bg-zinc-800/60" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-1">
              <div className="h-10 w-24 border border-zinc-700 bg-zinc-900/20" />
              <div className="h-2.5 w-16 bg-zinc-800/30" />
            </div>
          </div>
        </header>

        {/* Stats Metrics Grid Skeleton (4 Columns) */}
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Level Progress */}
          <div>
            <div className="mb-4 h-3 w-24 bg-zinc-800/30" />
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 border border-zinc-700 bg-[#1c2128]" />
              <div className="flex-1">
                <div className="mb-2 h-1.5 w-full bg-[#1c2128]" />
                <div className="h-2.5 w-32 bg-zinc-800/30" />
              </div>
            </div>
          </div>

          {/* Total Merges */}
          <div>
            <div className="mb-4 h-3 w-24 bg-zinc-800/30" />
            <div className="flex items-end gap-2">
              <div className="h-9 w-12 bg-zinc-800/60" />
              <div className="mb-1 h-4 w-4 bg-zinc-800/40" />
            </div>
          </div>

          {/* Mentor Points */}
          <div>
            <div className="mb-4 h-3 w-28 bg-zinc-800/30" />
            <div className="flex items-end gap-2">
              <div className="h-9 w-16 bg-zinc-800/60" />
              <div className="mb-1 h-5 w-5 bg-zinc-800/40" />
            </div>
          </div>

          {/* Current Streak */}
          <div>
            <div className="mb-4 h-3 w-28 bg-zinc-800/30" />
            <div className="flex items-end gap-2">
              <div className="h-9 w-12 bg-zinc-800/60" />
              <div className="mb-1 h-3 w-10 bg-zinc-800/30" />
            </div>
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* Left Column (Active Issues & Mentees) */}
          <div className="space-y-16">
            {/* Active Issues Section */}
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <div className="h-3 w-24 bg-zinc-800/30" />
                <div className="h-3 w-24 bg-zinc-800/30" />
              </div>
              <div className="space-y-6">
                {[1, 2].map((i) => (
                  <div key={i} className="border-b border-[#2d333b] py-6 last:border-0">
                    <div className="mb-3 h-4 w-14 bg-zinc-800/40" />
                    <div className="mb-4 h-6 w-5/6 bg-zinc-800/60" />
                    <div className="flex items-center justify-between">
                      <div className="h-7 w-16 bg-zinc-800/30" />
                      <div className="h-3 w-12 bg-zinc-800/40" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Mentees Section */}
            <section>
              <div className="mb-6 border-b border-[#2d333b] pb-4">
                <div className="h-3 w-24 bg-zinc-800/30" />
              </div>
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-[#2d333b] pb-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 border border-zinc-700 bg-[#1c2128]" />
                      <div className="space-y-2">
                        <div className="h-3 w-24 bg-zinc-800/50" />
                        <div className="h-3 w-36 bg-zinc-800/30" />
                      </div>
                    </div>
                    <div className="h-8 w-24 border border-zinc-700 bg-zinc-900/20" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column (My PRs & Leaderboard Snapshot) */}
          <div className="space-y-16">
            {/* My PRs Section */}
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <div className="h-3 w-16 bg-zinc-800/30" />
                <div className="flex items-center gap-4">
                  <div className="h-7 w-16 border border-zinc-700 bg-[#1c2128]" />
                  <div className="h-3 w-16 bg-zinc-800/30" />
                </div>
              </div>
              <div className="space-y-6">
                {[1, 2].map((i) => (
                  <div key={i} className="border-b border-[#2d333b] pb-6 last:border-0">
                    <div className="mb-2 h-5 w-4/5 bg-zinc-800/60" />
                    <div className="mb-3 h-3 w-48 bg-zinc-800/30" />
                    <div className="h-5 w-14 bg-zinc-800/40" />
                  </div>
                ))}
              </div>
            </section>

            {/* Leaderboard Section */}
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <div className="h-3 w-36 bg-zinc-800/30" />
                <div className="h-3 w-12 bg-zinc-800/30" />
              </div>
              <div className="space-y-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between border-b border-[#2d333b] py-3.5">
                    <div className="flex gap-5">
                      <div className="h-3 w-4 bg-zinc-800/30" />
                      <div className="h-3 w-28 bg-zinc-800/50" />
                    </div>
                    <div className="h-3 w-14 bg-zinc-800/40" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Footer Skeleton */}
        <footer className="mt-24 flex justify-between border-t border-[#2d333b] pt-8">
          <div className="h-3 w-36 bg-zinc-800/30" />
          <div className="flex gap-6">
            <div className="h-3 w-10 bg-zinc-800/30" />
            <div className="h-3 w-12 bg-zinc-800/30" />
            <div className="h-3 w-14 bg-zinc-800/30" />
          </div>
        </footer>
      </div>
    </div>
  );
}
