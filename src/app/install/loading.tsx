import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="flex items-center justify-between px-6 py-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-28" />
      </header>

      <main className="mx-auto mt-16 max-w-xl px-6">
        <Skeleton className="mb-4 h-10 w-64" />
        <div className="mb-6 space-y-3">
          <SkeletonText />
          <SkeletonText className="w-11/12" />
          <SkeletonText className="w-3/4" />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <Skeleton className="h-12 w-56 rounded-xl" />
        </div>

        <div className="mt-8 space-y-2">
          <SkeletonText className="h-3 w-full" />
          <SkeletonText className="h-3 w-2/3" />
        </div>
      </main>
    </div>
  );
}
