import { Skeleton, SkeletonText, SkeletonCard } from '@/components/skeleton';

export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-9 w-56" />
        <div className="mt-2 space-y-2">
          <SkeletonText className="h-3.5 w-full bg-zinc-800/40" />
          <SkeletonText className="h-3.5 w-3/4 bg-zinc-800/40" />
        </div>

        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <SkeletonText className="h-3.5 w-32" />
                <SkeletonText className="h-3 w-56 bg-zinc-800/40" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg bg-zinc-800/50" />
            </SkeletonCard>
          ))}
          <Skeleton className="h-11 w-40 rounded-lg bg-zinc-800/50" />
        </div>
      </div>
    </div>
  );
}
