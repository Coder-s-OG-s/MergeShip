import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0E12] px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex w-full items-center">
          <Skeleton className="h-6 w-36" />
        </div>

        <div className="flex w-full flex-col gap-2">
          <SkeletonText className="h-3 w-24" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>

        <Skeleton className="h-20 w-20 rounded-full" />

        <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <SkeletonText className="h-3 w-40" />
          </div>
          <div className="px-5 py-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <SkeletonText className="h-3.5 w-48" />
                </div>
                <SkeletonText className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>

        <SkeletonText className="h-3 w-56" />
      </div>
    </div>
  );
}
