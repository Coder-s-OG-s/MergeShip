import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0D0E12] px-6 py-6">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center">
          <Skeleton className="h-9 w-52 rounded-full" />
          <Skeleton className="mt-6 h-12 w-96" />
          <SkeletonText className="mt-4 h-4 w-72" />
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-md border border-zinc-800 bg-black/20 p-8">
              <Skeleton className="mb-8 h-40 w-full rounded" />
              <SkeletonText className="h-3 w-32" />
              <Skeleton className="mt-4 h-7 w-56" />
              <div className="mt-3 space-y-2">
                <SkeletonText />
                <SkeletonText className="w-3/4" />
              </div>
              <div className="mt-6 space-y-4">
                <SkeletonText className="w-2/3" />
                <SkeletonText className="w-2/3" />
                <SkeletonText className="w-2/3" />
              </div>
              <Skeleton className="mt-8 h-14 w-full rounded" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
