import { Skeleton, SkeletonText, SkeletonCard, SkeletonTableRow } from '@/components/skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-8 w-56 rounded-lg" />
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-1">
            <SkeletonText className="mb-4 h-3 w-28 bg-zinc-800/40" />
            <div className="space-y-4">
              <Skeleton className="h-12 w-full bg-zinc-800/60" />
              <Skeleton className="h-12 w-full bg-zinc-800/40" />
              <Skeleton className="h-12 w-full bg-zinc-800/40" />
            </div>
          </SkeletonCard>

          <SkeletonCard className="border-zinc-800 bg-[#161b22] p-5 lg:col-span-2">
            <SkeletonText className="mb-4 h-3 w-40 bg-zinc-800/40" />
            <div className="space-y-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonTableRow key={i} columns={4} />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
