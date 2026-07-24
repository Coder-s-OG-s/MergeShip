import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getActiveChatChannels } from '@/app/actions/chat';
import { isOk } from '@/lib/result';
import { getDb, schema } from '@/lib/db/client';
import { eq, and, or } from 'drizzle-orm';
import { ChatPanel } from '@/components/chat-panel';
import Link from 'next/link';

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

export default async function HelpInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ channelId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const channelId = resolvedParams.channelId;

  const sb = await getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-12 font-mono text-white">
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
      <div className="min-h-screen bg-zinc-950 px-6 py-12 font-mono text-white">
        <p className="text-gray-400">Service role not configured.</p>
      </div>
    );
  }

  // 1. Get logged-in user profile details for ChatPanel
  const { data: selfProfile } = await service
    .from('profiles')
    .select('github_handle, avatar_url')
    .eq('id', user.id)
    .single();

  // 2. Fetch active chat channels
  const channelsRes = await getActiveChatChannels();
  const activeChannels = isOk(channelsRes) ? channelsRes.data : [];

  // 3. Resolve current selected channel info
  let selectedChannel = activeChannels.find((c) => c.id === channelId) || null;
  if (!selectedChannel && channelId) {
    const db = getDb();
    const [c] = await db
      .select()
      .from(schema.chatChannels)
      .where(
        and(
          eq(schema.chatChannels.id, channelId),
          or(eq(schema.chatChannels.mentorId, user.id), eq(schema.chatChannels.menteeId, user.id)),
        ),
      )
      .limit(1);

    if (c) {
      const otherUserId = c.mentorId === user.id ? c.menteeId : c.mentorId;
      const [otherProfile] = await db
        .select({
          id: schema.profiles.id,
          githubHandle: schema.profiles.githubHandle,
          avatarUrl: schema.profiles.avatarUrl,
          level: schema.profiles.level,
        })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, otherUserId))
        .limit(1);

      if (otherProfile) {
        selectedChannel = {
          id: c.id,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          participant: otherProfile,
          unreadCount: 0,
          lastMessage: null,
        };
      }
    }
  }

  // 4. Load traditional help requests dispatched to the user
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

  let helpRows: Row[] = [];
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
    helpRows = (helps ?? []).map((h) => ({
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
    <div className="min-h-screen bg-zinc-950 px-6 py-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-wide text-white">
            MENTORSHIP & HELP CENTER
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Communicate securely with your assigned mentor or mentees. Open help requests dispatched
            to you are also listed below.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Channels list sidebar */}
          <div className="space-y-6 lg:col-span-1">
            <div>
              <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                ACTIVE CHAT SESSIONS ({activeChannels.length})
              </h2>

              {activeChannels.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-xs uppercase tracking-wider text-zinc-500">
                  No active chats. Start one from a profile!
                </div>
              ) : (
                <div className="space-y-2">
                  {activeChannels.map((chan) => {
                    const isSelected = selectedChannel?.id === chan.id;
                    return (
                      <Link
                        key={chan.id}
                        href={`/help-inbox?channelId=${chan.id}`}
                        className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-950/20'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        {chan.participant.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={chan.participant.avatarUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full border border-zinc-800"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="bg-zinc-850 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                            {chan.participant.githubHandle.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between">
                            <span className="truncate text-xs font-bold text-zinc-200">
                              @{chan.participant.githubHandle}
                            </span>
                            <span className="shrink-0 text-[9px] text-zinc-500">
                              L{chan.participant.level}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                            {chan.lastMessage ? chan.lastMessage.content : 'Secure channel opened'}
                          </p>
                        </div>

                        {chan.unreadCount > 0 && (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white">
                            {chan.unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Traditional help requests */}
            <div>
              <h2 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                DISPATCHED HELP REQUESTS ({helpRows.length})
              </h2>

              {helpRows.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-xs uppercase tracking-wider text-zinc-500">
                  No open help requests.
                </div>
              ) : (
                <ul className="divide-zinc-850 divide-y rounded-xl border border-zinc-800 bg-zinc-900/40">
                  {helpRows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-2 p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-300">
                            @{row.profile?.github_handle ?? 'unknown'}
                          </span>
                          <span className="rounded border border-zinc-800 bg-zinc-950 px-1 text-[9px] text-zinc-500">
                            L{row.profile?.level}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-600">
                          {new Date(row.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {formatReason(row.reason, recommendationById, issueById) && (
                        <p className="line-clamp-2 text-[11px] text-zinc-400">
                          {formatReason(row.reason, recommendationById, issueById)}
                        </p>
                      )}

                      {row.pr_url && (
                        <div className="mt-1 flex gap-2">
                          <a
                            href={row.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 truncate text-[10px] text-purple-400 hover:underline"
                          >
                            {row.pr_url}
                          </a>
                          <a
                            href={row.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-300 hover:bg-zinc-700"
                          >
                            REVIEW →
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Main chat window */}
          <div className="h-[600px] min-h-[500px] lg:col-span-2">
            {selectedChannel ? (
              <ChatPanel
                channelId={selectedChannel.id}
                currentUserId={user.id}
                currentUserHandle={selfProfile?.github_handle ?? ''}
                currentUserAvatar={selfProfile?.avatar_url ?? null}
                otherParticipantId={selectedChannel.participant.id}
                otherParticipantHandle={selectedChannel.participant.githubHandle}
                otherParticipantAvatar={selectedChannel.participant.avatarUrl}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/20 p-8 text-center">
                <div className="mb-4 text-4xl">🔮</div>
                <h3 className="font-serif text-lg font-bold uppercase tracking-widest text-zinc-300">
                  SELECT A CHAT SESSION
                </h3>
                <p className="mt-2 max-w-md text-xs uppercase leading-relaxed tracking-wide text-zinc-500">
                  Start an instant mentorship channel from a contributor's profile page, or choose
                  an existing chat session from the list on the left.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
