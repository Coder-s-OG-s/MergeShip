import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function PublicProfileLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-white">
      <nav className="border-b border-[#21262d] px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </nav>

      <div className="border-b border-[#21262d] bg-gradient-to-b from-[#1a1040] to-[#0d1117]">
        <div className="mx-auto max-w-6xl px-8 py-12">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-sm" />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-6 w-32" />
              </div>
              <SkeletonText className="h-3 w-40" />
              <SkeletonText className="h-3 w-32" />
              <div className="flex flex-wrap gap-4 pt-1">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonText key={i} className="h-3 w-24" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr_280px]">
          <div>
            <SkeletonText className="mb-5 h-3 w-24" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 rounded-sm border border-[#21262d] bg-[#161b22] p-4"
                >
                  <Skeleton className="h-8 w-8" />
                  <SkeletonText className="h-2.5 w-16" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <SkeletonText className="mb-5 h-3 w-40" />
              <div className="space-y-6 border-l border-[#21262d] pl-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <SkeletonText className="h-4 w-3/4" />
                    <SkeletonText className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#21262d] pt-8">
              <SkeletonText className="mb-5 h-3 w-16" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border border-[#21262d] bg-[#161b22] p-4">
                    <SkeletonText className="mb-2 h-2.5 w-16" />
                    <Skeleton className="h-7 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <SkeletonText className="mb-5 h-3 w-28" />
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border border-[#21262d] bg-[#161b22] p-4"
                  >
                    <Skeleton className="h-10 w-10 rounded-sm" />
                    <div className="flex-1 space-y-2">
                      <SkeletonText className="h-3 w-24" />
                      <SkeletonText className="h-2.5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#21262d] px-8 py-6">
        <div className="mx-auto flex max-w-6xl justify-between">
          <SkeletonText className="h-3 w-56" />
          <div className="flex gap-6">
            <SkeletonText className="h-3 w-12" />
            <SkeletonText className="h-3 w-12" />
          </div>
        </div>
      </footer>
    </div>
  );
}
