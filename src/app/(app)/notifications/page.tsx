import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import {
  notificationMessage,
  notificationLink,
  type ActivityDetail,
} from '@/lib/activity/notifications';

export const dynamic = 'force-dynamic';

type ActivityRow = {
  id: number;
  kind: string;
  detail: ActivityDetail;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * In-app notification center. Reads across every activity_log kind for the
 * signed-in user (unlike /help-inbox, which only surfaces kind='help_dispatch'
 * joined against live help_requests). This is read-only for now -- no
 * read/unread tracking yet, that's a follow-up phase.
 */
export default async function NotificationsPage() {
  const sb = await getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen bg-[#000E12] px-6 py-12 text-white">
        <p className="text-zinc-400">Service not configured.</p>
      </div>
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service) {
    return (
      <div className="min-h-screen bg-[#000E12] px-6 py-12 text-white">
        <p className="text-zinc-400">Service role not configured.</p>
      </div>
    );
  }

  const { data } = await service
    .from('activity_log')
    .select('id, kind, detail, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const items = (data ?? []) as ActivityRow[];

  return (
    <div className="min-h-screen bg-[#000E12] px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Recent activity across claims, mentor reviews, and merged PRs.
        </p>

        <section className="mt-6 border border-zinc-800 bg-[#161b22]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-[11px] uppercase tracking-widest text-zinc-600">
              <Bell className="mx-auto mb-3 h-5 w-5 text-zinc-700" />
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {items.map((item) => {
                const message = notificationMessage(item.kind, item.detail);
                const link = notificationLink(item.kind, item.detail);

                return (
                  <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      {link ? (
                        // prettier-ignore
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-200 hover:text-[#00FF87] hover:underline">
                          {message}
                        </a>
                      ) : (
                        <p className="text-[13px] text-zinc-200">{message}</p>
                      )}
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-600">
                        {timeAgo(item.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
