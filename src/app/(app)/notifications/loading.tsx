import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-[#000E12] px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <SkeletonText className="mt-3 h-4 w-80" />

        <section className="mt-6 border border-zinc-800 bg-[#161b22]">
          <ul className="divide-y divide-zinc-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonText className="h-3.5 w-3/4" />
                  <SkeletonText className="h-2.5 w-20" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
