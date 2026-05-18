// src/app/(app)/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
