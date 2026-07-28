import { Skeleton, SkeletonText, SkeletonCard } from '@/components/skeleton';

export default function PrDetailLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="mb-6 h-4 w-40 bg-zinc-800/40" />
        <Skeleton className="mb-6 h-4 w-64 bg-zinc-800/30" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-16 w-full rounded-2xl bg-zinc-900/60" />

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
              <SkeletonText className="mb-2 h-3 w-40 bg-zinc-800/40" />
              <Skeleton className="mb-4 h-8 w-3/4 bg-zinc-800/60" />
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-6 w-20 rounded-full bg-zinc-800/50" />
                <Skeleton className="h-6 w-24 rounded-full bg-zinc-800/40" />
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-zinc-800/80 pt-6">
                <Skeleton className="h-9 w-9 rounded-xl bg-zinc-800/60" />
                <div className="space-y-2">
                  <SkeletonText className="h-3.5 w-28" />
                  <SkeletonText className="h-3 w-16 bg-zinc-800/40" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
              <Skeleton className="mb-6 h-5 w-40 bg-zinc-800/60" />
              <div className="space-y-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-zinc-800/60" />
                    <SkeletonCard className="flex-1 border-zinc-800/80 bg-zinc-900/40">
                      <SkeletonText className="h-3.5 w-48" />
                      <SkeletonText className="mt-2 h-3 w-2/3 bg-zinc-800/40" />
                    </SkeletonCard>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
              <Skeleton className="mb-6 h-5 w-32 bg-zinc-800/60" />
              <Skeleton className="h-48 w-full rounded-2xl bg-zinc-900/60" />
            </div>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
              <Skeleton className="mb-4 h-4 w-40 bg-zinc-800/60" />
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl bg-zinc-800/30" />
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-emerald-500/40 bg-[#0c0c0e] p-6">
              <Skeleton className="mb-6 h-4 w-32 bg-zinc-800/60" />
              <Skeleton className="h-24 w-full rounded-lg bg-zinc-800/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
