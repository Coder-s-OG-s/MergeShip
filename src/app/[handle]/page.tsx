import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { tryGetDb } from '@/lib/db/client';
import { cacheGet, cacheSet } from '@/lib/cache';

export const revalidate = 300; // 5min ISR

type ProfileView = {
  githubHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  mergedPrs: number;
  mentees: number;
};

/**
 * Public profile page at /@username. Bypass install gate via middleware.
 * Cached 5 min (SWR pattern via Next revalidate + Redis tier).
 */
export default async function PublicProfile({ params }: { params: { handle: string } }) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, '');
  const profile = await loadProfile(handle);
  if (!profile) {
    if (!tryGetDb()) {
      return (
        <div className="min-h-screen px-6 py-20 text-white">
          <div className="mx-auto max-w-xl">
            <h1 className="mb-4 font-display text-3xl font-bold">Profile not available</h1>
            <p className="text-zinc-400">Service is not configured on this deployment.</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-5">
          {profile.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={`@${profile.githubHandle} avatar`}
              className="h-20 w-20 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <h1 className="font-display text-3xl font-bold">
              {profile.displayName ?? `@${profile.githubHandle}`}
            </h1>
            {profile.displayName && <p className="text-zinc-500">@{profile.githubHandle}</p>}
          </div>
        </header>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Level" value={`L${profile.level}`} />
          <Stat label="XP" value={profile.xp.toLocaleString()} />
          <Stat label="Merged PRs" value={profile.mergedPrs.toLocaleString()} />
          <Stat label="Mentees" value={profile.mentees.toLocaleString()} />
        </dl>

        <p className="mt-10 text-sm text-zinc-500">
          Verified contributor activity on MergeShip. Embeddable card and JSON API in a future
          release.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
    </div>
  );
}

async function loadProfile(handle: string): Promise<ProfileView | null> {
  const cacheKey = `profile:public:${handle}`;
  const cached = await cacheGet<ProfileView>(cacheKey);
  if (cached) return cached;

  const db = tryGetDb();
  if (!db) return null;
  const rows = (await db.execute(sql`
    select
      p.github_handle,
      p.display_name,
      p.avatar_url,
      p.level,
      p.xp,
      coalesce((
        select count(*)::int from xp_events
        where user_id = p.id and source = 'recommended_merge'
      ), 0) as merged_prs,
      coalesce((
        select count(distinct user_id)::int from help_requests
        where resolved_by = p.id
      ), 0) as mentees
    from profiles p
    where p.github_handle = ${handle}
    limit 1
  `)) as unknown as Array<{
    github_handle: string;
    display_name: string | null;
    avatar_url: string | null;
    level: number;
    xp: number;
    merged_prs: number;
    mentees: number;
  }>;

  const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: typeof rows }).rows;
  const row = list[0];
  if (!row) return null;

  const view: ProfileView = {
    githubHandle: row.github_handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    level: row.level,
    xp: row.xp,
    mergedPrs: row.merged_prs,
    mentees: row.mentees,
  };

  await cacheSet(cacheKey, view, 300);
  return view;
}
