import Link from 'next/link';
import { ArrowRight, Calendar, Megaphone } from 'lucide-react';

import { getServiceSupabase } from '@/lib/supabase/service';

export async function RightSidebar({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  if (!service) return <RightSidebarSkeleton />;

  const [sessionRes, announcementsRes] = await Promise.all([
    service
      .from('mentor_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    service.from('announcements').select('*').order('published_at', { ascending: false }).limit(5),
  ]);

  const session = sessionRes.data;
  const announcementsList = announcementsRes.data ?? [];

  const hasScheduledSession = session?.scheduled_at != null;

  return (
    <aside className="space-y-10">
      {/* Browse Issues CTA */}
      <div>
        <Link
          href="/issues"
          className="flex w-full items-center justify-center gap-2 border border-[#00FF87] bg-[#10b981]/10 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#00FF87] transition-colors hover:bg-[#10b981]/20"
        >
          BROWSE ISSUES <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Next Mentor Session */}
      <section>
        <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Calendar className="h-3.5 w-3.5 text-zinc-600" />
          <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
            NEXT MENTOR SESSION
          </h2>
        </div>
        <div className="border border-zinc-800 bg-[#161b22] p-4">
          <div className="mb-1 text-[12px] text-zinc-300">
            {session?.mentor_login ?? 'No mentor assigned'}
          </div>
          <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-600">
            {session?.note ?? 'No session scheduled yet.'}
          </div>
          <div className="flex gap-2">
            <button
              disabled={!hasScheduledSession}
              className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              RESCHEDULE
            </button>
            <button
              disabled={!hasScheduledSession}
              className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              JOIN CALL
            </button>
          </div>
        </div>
      </section>

      {/* Announcements */}
      <section>
        <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Megaphone className="h-3.5 w-3.5 text-zinc-600" />
          <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">ANNOUNCEMENTS</h2>
        </div>
        <div className="space-y-0">
          {announcementsList.length === 0 ? (
            <div className="py-3 text-[11px] text-zinc-500">No announcements at this time.</div>
          ) : (
            announcementsList.map((a) => (
              <div key={a.id} className="border-b border-zinc-800 py-3 last:border-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] text-zinc-300">{a.title}</span>
                  <span className="ml-2 shrink-0 text-[10px] uppercase tracking-widest text-zinc-600">
                    {new Date(a.published_at).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500">{a.body}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}

export function RightSidebarSkeleton() {
  return (
    <aside className="space-y-10">
      <div className="h-10 w-full animate-pulse bg-zinc-800" />
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse bg-zinc-800" />
        <div className="h-24 w-full animate-pulse bg-zinc-800" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse bg-zinc-800" />
        {[1, 2].map((i) => (
          <div key={i} className="space-y-1.5 border-b border-zinc-800 pb-3">
            <div className="h-3 w-36 animate-pulse bg-zinc-800" />
            <div className="h-3 w-full animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </aside>
  );
}
