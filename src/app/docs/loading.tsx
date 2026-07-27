import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <nav className="flex items-center justify-between px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <div className="hidden gap-6 md:flex">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="mb-6 h-6 w-28" />
        <Skeleton className="mb-6 h-12 w-3/4" />
        <div className="mb-10 space-y-3">
          <SkeletonText className="w-11/12" />
          <SkeletonText className="w-4/5" />
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <SkeletonText />
            <SkeletonText className="w-11/12" />
            <SkeletonText className="w-full" />
            <SkeletonText className="w-3/4" />
          </div>
          <div className="space-y-3">
            <SkeletonText />
            <SkeletonText className="w-5/6" />
            <SkeletonText className="w-2/3" />
          </div>
          <Skeleton className="h-8 w-1/2" />
          <div className="space-y-3">
            <SkeletonText />
            <SkeletonText className="w-11/12" />
            <SkeletonText className="w-4/5" />
          </div>
        </div>
      </main>
    </div>
  );
}
