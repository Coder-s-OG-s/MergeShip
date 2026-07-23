import { Skeleton, SkeletonText, SkeletonCard, SkeletonTableRow, SkeletonStat } from '@/components/skeleton';

export default function ContributorsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <SkeletonText className="h-3.5 w-64 bg-zinc-800/40" />
          </div>
          <Skeleton className="h-9 w-40 rounded-lg bg-zinc-800/40" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonStat key={i} />
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-4">
          <SkeletonCard className="lg:col-span-3">
            <div className="space-y-1">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonTableRow key={i} columns={5} />
              ))}
            </div>
          </SkeletonCard>

          <div className="flex flex-col gap-8 lg:col-span-1">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
