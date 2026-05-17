import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type Row = {
  id: number;
  reason: string | null;
  pr_url: string;
  status: string;
  created_at: string;
  user_id: string;
  profile: { github_handle: string; avatar_url: string | null; level: number } | null;
};

type RecommendationRow = {
  id: number;
  issue_id: number;
};

type IssueRow = {
  id: number;
  repo_full_name: string;
  title: string;
};

function formatReason(
  reason: string | null,
  recommendationById: Map<number, RecommendationRow>,
  issueById: Map<number, IssueRow>,
): string | null {
  if (!reason) return null;

  const recMatch = reason.match(/^rec:(\d+)$/);
  if (!recMatch) return reason;

  const recId = Number(recMatch[1]);
  const recommendation = recommendationById.get(recId);
  const issue = recommendation ? issueById.get(recommendation.issue_id) : null;

  if (!issue) return 'Recommended issue';

  return `${issue.repo_full_name} · ${issue.title}`;
}

/**
 * Mentor inbox. Lists open help_requests dispatched to the signed-in user.
 *
 * The help-dispatch Inngest function writes an `activity_log` row with
 * kind='help_dispatch' and detail.helpRequestId pointing at the live request.
 * We join those rows back to help_requests, filter to open status, and show
 * mentee context.
 */
export default async function HelpInboxPage() {
  const sb = getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen px-6 py-12 text-white">
        <p className="text-gray-400">Service not configured.</p>
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
      <div className="min-h-screen px-6 py-12 text-white">
        <p className="text-gray-400">Service role not configured.</p>
      </div>
    );
  }

  // Pull recent dispatch notifications for this user.
  const { data: notifications } = await service
    .from('activity_log')
    .select('detail, created_at')
    .eq('user_id', user.id)
    .eq('kind', 'help_dispatch')
    .order('created_at', { ascending: false })
    .limit(50);

  const helpIds = Array.from(
    new Set(
      (notifications ?? [])
        .map((n) => {
          const d = n.detail as { helpRequestId?: number } | null;
          return d?.helpRequestId;
        })
        .filter((x): x is number => typeof x === 'number'),
    ),
  );

  let rows: Row[] = [];
  let recommendationById = new Map<number, RecommendationRow>();
  let issueById = new Map<number, IssueRow>();

  if (helpIds.length > 0) {
    const { data: helps } = await service
      .from('help_requests')
      .select('id, user_id, reason, pr_url, status, created_at')
      .in('id', helpIds)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    const userIds = Array.from(new Set((helps ?? []).map((h) => h.user_id)));
    const { data: profiles } = await service
      .from('profiles')
      .select('id, github_handle, avatar_url, level')
      .in('id', userIds);

    const recIds = Array.from(
      new Set(
        (helps ?? [])
          .map((help) => help.reason?.match(/^rec:(\d+)$/)?.[1])
          .filter((value): value is string => typeof value === 'string')
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      ),
    );

    if (recIds.length > 0) {
      const { data: recs } = await service
        .from('recommendations')
        .select('id, issue_id')
        .in('id', recIds);

      recommendationById = new Map((recs ?? []).map((rec) => [rec.id, rec]));

      const issueIds = Array.from(
        new Set((recs ?? []).map((rec) => rec.issue_id).filter((id) => typeof id === 'number')),
      );

      if (issueIds.length > 0) {
        const { data: issues } = await service
          .from('issues')
          .select('id, repo_full_name, title')
          .in('id', issueIds);

        issueById = new Map((issues ?? []).map((issue) => [issue.id, issue]));
      }
    }

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    rows = (helps ?? []).map((h) => ({
      id: h.id,
      reason: h.reason,
      pr_url: h.pr_url,
      status: h.status,
      created_at: h.created_at,
      user_id: h.user_id,
      profile: byId.get(h.user_id) ?? null,
    }));
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold">Help inbox</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Mentees who picked you in the dispatch ring. Open the PR on GitHub to review — XP fires
          when your review lands.
        </p>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            No open help requests dispatched to you.
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-4 p-4">
                {row.profile?.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.profile.avatar_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">@{row.profile?.github_handle ?? 'unknown'}</span>
                    {row.profile && (
                      <span className="text-xs text-zinc-500">L{row.profile.level}</span>
                    )}
                    <span className="text-xs text-zinc-600">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                  {formatReason(row.reason, recommendationById, issueById) && (
                    <p className="mt-1 truncate text-sm text-zinc-400">
                      {formatReason(row.reason, recommendationById, issueById)}
                    </p>
                  )}
                  <a
                    href={row.pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block break-all text-sm text-purple-400 hover:underline"
                  >
                    {row.pr_url}
                  </a>
                </div>
                <a
                  href={row.pr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
                >
                  Review on GitHub →
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
