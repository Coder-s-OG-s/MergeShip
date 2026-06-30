import { getServiceSupabase } from '@/lib/supabase/service';
import Link from 'next/link';

export default async function MenteesSection({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  if (!service) return null;

  // Mentees
  const { data: menteesData } = await service
    .from('help_requests')
    .select('id, pr_url, status, user_id')
    .eq('resolved_by', userId)
    .in('status', ['open', 'escalated'])
    .limit(2);

  let enrichedMentees: any[] = [];
  if (menteesData && menteesData.length > 0) {
    const userIds = menteesData.map((m: any) => m.user_id);
    const { data: menteeProfiles } = await service
      .from('profiles')
      .select('id, github_handle')
      .in('id', userIds);
    enrichedMentees = menteesData.map((m: any) => {
      const p = menteeProfiles?.find((p) => p.id === m.user_id);
      return { ...m, github_handle: p?.github_handle || 'Unknown' };
    });
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">YOUR MENTEES</h2>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
        {enrichedMentees && enrichedMentees.length > 0 ? (
          <div className="space-y-4">
            {enrichedMentees.map((mentee: any) => (
              <div
                key={mentee.id}
                className="flex items-center justify-between border-b border-zinc-800 pb-4 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-800 bg-[#1c2128] text-xs uppercase text-zinc-500">
                    {mentee.github_handle.substring(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold uppercase tracking-widest text-zinc-200">
                      {mentee.github_handle}
                    </div>
                    <div className="text-[10px] text-zinc-400">Help Request: {mentee.status}</div>
                  </div>
                </div>
                <Link
                  href={mentee.pr_url || '#'}
                  className="shrink-0 border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  REVIEW DRAFT
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            No active mentees assigned to you.
          </div>
        )}
      </div>
    </section>
  );
}

export function MenteesSkeleton() {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">YOUR MENTEES</h2>
      </div>
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-zinc-800 pb-4 last:border-0"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 animate-pulse bg-zinc-800" />
              <div>
                <div className="mb-1 h-3 w-20 animate-pulse bg-zinc-800" />
                <div className="h-3 w-32 animate-pulse bg-zinc-800" />
              </div>
            </div>
            <div className="h-8 w-24 shrink-0 animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
