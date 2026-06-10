import { getServiceSupabase } from '@/lib/supabase/service';
import { TrendingUp } from 'lucide-react';

type XpEvent = {
  id: string;
  xp_delta: number;
  source: string;
  created_at: string;
  metadata: Record<string, any> | null;
};

function sourceLabel(source: string, metadata: Record<string, any> | null): string {
  switch (source) {
    case 'pr_merged':
      return metadata?.repo ? `PR merged in ${metadata.repo}` : 'Pull request merged';
    case 'issue_completed':
      return 'Issue completed';
    case 'review':
      return 'Code review submitted';
    case 'help_review':
      return 'Helped a contributor';
    case 'course_completion':
      return 'Course step completed';
    default:
      return source.replace(/_/g, ' ');
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function RecentActivity({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  if (!service) return null;

  const { data: events } = await service
    .from('xp_events')
    .select('id, xp_delta, source, created_at, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(6);

  const items = (events ?? []) as XpEvent[];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-[#2d333b] pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">RECENT ACTIVITY</h2>
        <TrendingUp className="h-3.5 w-3.5 text-zinc-600" />
      </div>

      {items.length === 0 ? (
        <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-600">
          No activity yet — claim an issue to get started.
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between border-b border-[#2d333b] py-3 last:border-0"
            >
              <div>
                <div className="text-[12px] capitalize text-zinc-300">
                  {sourceLabel(event.source, event.metadata)}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-600">
                  {timeAgo(event.created_at)}
                </div>
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-widest ${event.xp_delta >= 0 ? 'text-[#10b981]' : 'text-red-400'}`}
              >
                {event.xp_delta >= 0 ? '+' : ''}
                {event.xp_delta} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecentActivitySkeleton() {
  return (
    <section>
      <div className="mb-4 border-b border-[#2d333b] pb-3">
        <div className="h-3 w-28 animate-pulse bg-zinc-800" />
      </div>
      <div className="space-y-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between border-b border-[#2d333b] py-3">
            <div className="space-y-1.5">
              <div className="h-3 w-40 animate-pulse bg-zinc-800" />
              <div className="h-2.5 w-16 animate-pulse bg-zinc-800" />
            </div>
            <div className="h-3 w-12 animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
