import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen justify-center bg-[#0D0E12] px-6 py-16 text-white">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <SkeletonText className="h-4 w-3/4" />
        </div>

        <Skeleton className="h-11 w-full rounded-md" />

        <ul className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i}>
              <div className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                <Skeleton className="h-5 w-5 rounded" />
                <SkeletonText className="h-4 flex-1" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-10" />
                <Skeleton className="h-3.5 w-12" />
              </div>
            </li>
          ))}
        </ul>

        <Skeleton className="mt-2 h-12 w-full rounded-md" />
      </div>
    </main>
  );
}
