import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="space-y-3">
        <SkeletonText />
        <SkeletonText className="w-11/12" />
        <SkeletonText className="w-4/5" />
        <SkeletonText className="w-3/4" />
        <SkeletonText className="w-11/12" />
        <SkeletonText className="w-2/3" />
      </div>
    </main>
  );
}
