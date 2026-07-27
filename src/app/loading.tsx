import { Skeleton, SkeletonText, SkeletonStat } from '@/components/skeleton';

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

      <header className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-24 text-center">
        <Skeleton className="mb-8 h-6 w-40 rounded-full" />
        <Skeleton className="mb-4 h-14 w-3/4" />
        <Skeleton className="mb-8 h-14 w-1/2" />
        <div className="mb-10 w-full max-w-2xl space-y-3">
          <SkeletonText className="mx-auto w-11/12" />
          <SkeletonText className="mx-auto w-4/5" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-12 w-48" />
        </div>
      </header>

      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-8 px-6 py-16 md:grid-cols-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </section>
    </div>
  );
}
