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
    <section>
      <div className="mb-6 border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">YOUR MENTEES</h2>
      </div>
      <div className="space-y-4">
        {enrichedMentees && enrichedMentees.length > 0 ? (
          enrichedMentees.map((mentee: any) => (
            <div
              key={mentee.id}
              className="flex items-center justify-between border-b border-[#2d333b] pb-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center border border-zinc-800 bg-[#1c2128] text-xs uppercase text-zinc-500">
                  {mentee.github_handle.substring(0, 2)}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                    {mentee.github_handle}
                  </div>
                  <div className="text-sm text-zinc-400">Help Request: {mentee.status}</div>
                </div>
              </div>
              <Link
                href={mentee.pr_url || '#'}
                className="border border-zinc-700 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                REVIEW DRAFT
              </Link>
            </div>
          ))
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
    <section>
      <div className="mb-6 border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">YOUR MENTEES</h2>
      </div>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between border-b border-[#2d333b] pb-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 animate-pulse bg-zinc-800" />
              <div>
                <div className="mb-1 h-3 w-20 animate-pulse bg-zinc-800" />
                <div className="h-3 w-32 animate-pulse bg-zinc-800" />
              </div>
            </div>
            <div className="h-8 w-28 animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
