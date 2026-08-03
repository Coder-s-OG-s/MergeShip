import { Skeleton, SkeletonText } from '@/components/skeleton';

export default function ProfileSettingsLoading() {
  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-3xl">
        <SkeletonText className="mb-4 h-3 w-32" />
        <Skeleton className="mb-2 h-9 w-64" />
        <SkeletonText className="mb-8 h-4 w-96" />

        <div className="border border-[#21262d] bg-[#161b22] p-6">
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <SkeletonText className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <div className="flex justify-end border-t border-zinc-800 pt-4">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>

        <div className="mt-6 border border-[#21262d] bg-[#161b22] p-4">
          <SkeletonText className="mb-3 h-4 w-16" />
          <div className="space-y-2">
            <SkeletonText className="h-3 w-3/4" />
            <SkeletonText className="h-3 w-2/3" />
            <SkeletonText className="h-3 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
