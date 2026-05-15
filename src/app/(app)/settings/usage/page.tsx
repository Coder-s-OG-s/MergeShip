import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getUsage, type UsageEntry } from '@/app/actions/usage';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  claim: 'Claimed an issue',
  pr_merged: 'PR merged',
  help_dispatch: 'Help dispatched',
  help_review_landed: 'Mentor review credited',
  mentor_comment_posted: 'Mentor comment posted',
  mentor_comment_error: 'Mentor comment error',
  pr_backfilled: 'Backfilled PR history',
  pr_mentor_verified: 'Your PR was mentor-verified',
  xp_tripwire: 'Daily XP tripwire',
};

export default async function UsagePage() {
  const sb = getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const { todayXp, weekXp, entries } = await getUsage();

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          Settings / Usage
        </div>
        <h1 className="mb-2 font-serif text-3xl text-white">Your usage</h1>
        <p className="mb-8 text-sm text-zinc-400">
          Every read, write, and award MergeShip makes on your behalf. Kept 30 days, then
          auto-cleaned.
        </p>

        <div className="mb-10 grid grid-cols-2 gap-4">
          <StatCard label="XP today" value={todayXp.toLocaleString()} />
          <StatCard label="XP this week" value={weekXp.toLocaleString()} />
        </div>

        <h2 className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">
          Recent activity
        </h2>
        {entries.length === 0 ? (
          <div className="border border-[#21262d] bg-[#161b22] p-6 text-sm text-zinc-500">
            No activity in the last 30 days.
          </div>
        ) : (
          <ul className="divide-y divide-[#21262d] border border-[#21262d] bg-[#161b22]">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#21262d] bg-[#161b22] p-5">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-serif text-3xl font-bold text-[#39d353]">{value}</div>
    </div>
  );
}

function EntryRow({ entry }: { entry: UsageEntry }) {
  const label = KIND_LABEL[entry.kind] ?? entry.kind;
  const detailString = entry.detail ? compactDetail(entry.detail) : '';
  return (
    <li className="flex items-start gap-3 p-4 text-sm">
      <span className="w-44 shrink-0 text-zinc-300">{label}</span>
      <span className="flex-1 text-xs text-zinc-500">{detailString}</span>
      <span className="shrink-0 text-xs text-zinc-600">
        {new Date(entry.createdAt).toLocaleString()}
      </span>
    </li>
  );
}

function compactDetail(detail: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue;
    parts.push(`${k}=${String(v)}`);
  }
  return parts.slice(0, 4).join(' · ');
}
