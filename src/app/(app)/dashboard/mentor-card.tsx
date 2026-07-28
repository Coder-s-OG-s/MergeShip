import { Calendar } from 'lucide-react';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getDb, schema } from '@/lib/db/client';
import { eq, and } from 'drizzle-orm';
import { ChatPanel } from '@/components/chat-panel';

export async function MentorCard() {
  const sb = await getServerSupabase();
  if (!sb) return <StaticMentorCard />;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return <StaticMentorCard />;

  const service = getServiceSupabase();
  if (!service) return <StaticMentorCard />;

  const { data: profile } = await service
    .from('profiles')
    .select('id, github_handle, avatar_url, level')
    .eq('id', user.id)
    .single();

  if (!profile) return <StaticMentorCard />;

  // Find mentor from help_requests or mentor_sessions
  let mentorId: string | null = null;
  const { data: activeHelp } = await service
    .from('help_requests')
    .select('resolved_by')
    .eq('user_id', user.id)
    .in('status', ['open', 'escalated'])
    .not('resolved_by', 'is', null)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeHelp?.resolved_by) {
    mentorId = activeHelp.resolved_by;
  }

  if (!mentorId) {
    // Check mentor sessions
    const { data: session } = await service
      .from('mentor_sessions')
      .select('mentor_login')
      .eq('user_id', user.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session?.mentor_login) {
      const { data: mentorProfile } = await service
        .from('profiles')
        .select('id')
        .eq('github_handle', session.mentor_login)
        .maybeSingle();
      mentorId = mentorProfile?.id ?? null;
    }
  }

  // Fallback to a default mentor if no mentor is found
  if (!mentorId) {
    const { data: defaultMentor } = await service
      .from('profiles')
      .select('id')
      .eq('github_handle', 'priya.codes')
      .maybeSingle();
    mentorId = defaultMentor?.id ?? null;
  }

  if (mentorId && mentorId !== user.id) {
    const { data: mentorProfile } = await service
      .from('profiles')
      .select('id, github_handle, avatar_url, level')
      .eq('id', mentorId)
      .single();

    if (mentorProfile) {
      // Validate relationship eligibility (different levels, mentor is >= L2)
      const mentorLevel = Math.max(profile.level, mentorProfile.level);
      const menteeLevel = Math.min(profile.level, mentorProfile.level);
      const isValid = mentorLevel >= 2 && mentorLevel > menteeLevel;

      if (isValid) {
        const actualMentorId = profile.level > mentorProfile.level ? profile.id : mentorProfile.id;
        const actualMenteeId = profile.level > mentorProfile.level ? mentorProfile.id : profile.id;

        const db = getDb();
        let [channel] = await db
          .select()
          .from(schema.chatChannels)
          .where(
            and(
              eq(schema.chatChannels.mentorId, actualMentorId),
              eq(schema.chatChannels.menteeId, actualMenteeId),
            ),
          )
          .limit(1);

        if (!channel) {
          const [inserted] = await db
            .insert(schema.chatChannels)
            .values({
              mentorId: actualMentorId,
              menteeId: actualMenteeId,
            })
            .returning();
          channel = inserted;
        }

        if (channel) {
          return (
            <section className="flex h-full flex-col border border-zinc-800 bg-[#161b22] p-5">
              <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                  <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                    CHAT WITH @{mentorProfile.github_handle}
                  </h2>
                </div>
                <Link
                  href={`/help-inbox?channelId=${channel.id}`}
                  className="text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:underline"
                >
                  FULL VIEW →
                </Link>
              </div>

              <div className="h-[280px] min-h-0 flex-1">
                <ChatPanel
                  channelId={channel.id}
                  currentUserId={user.id}
                  currentUserHandle={profile.github_handle}
                  currentUserAvatar={profile.avatar_url}
                  otherParticipantId={mentorProfile.id}
                  otherParticipantHandle={mentorProfile.github_handle}
                  otherParticipantAvatar={mentorProfile.avatar_url}
                  isCompact={true}
                />
              </div>
            </section>
          );
        }
      }
    }
  }

  return <StaticMentorCard />;
}

function StaticMentorCard() {
  return (
    <section className="flex h-full flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Calendar className="h-3.5 w-3.5 text-zinc-600" />
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">NEXT MENTOR SESSION</h2>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
            <span className="text-2xl text-zinc-500">+</span>
          </div>
          <p className="mb-4 text-sm text-zinc-400">You haven't connected with any mentors yet.</p>
          <button className="mt-2 rounded bg-[#00FF87] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#00FF87]/80">
            FIND A MENTOR
          </button>
        </div>
      </div>
    </section>
  );
}

export function MentorSkeleton() {
  return (
    <section className="flex h-full flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 h-4 w-32 animate-pulse bg-zinc-800" />
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6">
        <div className="mb-4 h-12 w-12 animate-pulse rounded-full bg-zinc-800" />
        <div className="mb-2 h-4 w-48 animate-pulse bg-zinc-800" />
        <div className="h-4 w-24 animate-pulse bg-zinc-800" />
      </div>
    </section>
  );
}
