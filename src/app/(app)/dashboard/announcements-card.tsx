import { Megaphone } from 'lucide-react';

// Static data — replace with DB queries when `announcements` table exists
const ANNOUNCEMENTS = [
  {
    id: 1,
    title: "GSSoC '26 has started!",
    body: 'Welcome to the program. Check your assigned issues and start contributing.',
    date: 'Jun 2026',
  },
  {
    id: 2,
    title: 'New repos added to MergeShip',
    body: 'Three new repositories are now available for contributions.',
    date: 'Jun 2026',
  },
];

export function AnnouncementsCard() {
  return (
    <section className="flex min-h-0 flex-1 flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Megaphone className="h-3.5 w-3.5 text-[#00FF87]" />
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-300">ANNOUNCEMENTS</h2>
      </div>
      <div className="custom-scrollbar flex-1 space-y-0 overflow-y-auto pr-2">
        {ANNOUNCEMENTS.map((a) => (
          <div key={a.id} className="border-b border-zinc-800 py-3 last:border-0">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] text-zinc-300">{a.title}</span>
              <span className="ml-2 shrink-0 text-[10px] uppercase tracking-widest text-[#00FF87]">
                {a.date}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500">{a.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <section className="flex min-h-0 flex-1 flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 h-4 w-32 animate-pulse bg-zinc-800" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="border-b border-zinc-800 pb-3 last:border-0">
            <div className="mb-2 h-3 w-48 animate-pulse bg-zinc-800" />
            <div className="h-2 w-full animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
