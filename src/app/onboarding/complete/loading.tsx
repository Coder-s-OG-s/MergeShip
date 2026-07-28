import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0D0E12] text-white">
      <header className="flex items-center justify-between px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <div className="hidden items-center gap-4 sm:flex">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-xl flex-col items-center">
          <Skeleton className="h-24 w-24 rounded-2xl" />
          <SkeletonText className="mt-8 h-3 w-32" />
          <Skeleton className="mt-4 h-9 w-80" />
          <SkeletonText className="mt-3 h-4 w-64" />

          <div className="mt-10 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 border-b border-zinc-800/60 px-5 py-4 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4" />
                  <SkeletonText className="h-3.5 w-40" />
                </div>
                <SkeletonText className="h-3.5 w-24" />
              </div>
            ))}
          </div>

          <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row">
            <Skeleton className="h-12 flex-1 rounded-md" />
            <Skeleton className="h-12 flex-1 rounded-md" />
          </div>
        </div>
      </section>
    </main>
  );
}
