import { Skeleton, SkeletonText, SkeletonCard } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-40" />
          <SkeletonText className="w-3/4" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i}>
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonText className="h-4 w-24" />
                  <SkeletonText className="h-3 w-40" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  );
}
