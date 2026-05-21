import { getServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ChatPanel from '@/components/chat/ChatPanel';
import MentorshipSessionsSidebar from '@/components/chat/MentorshipSessionsSidebar';

export const dynamic = 'force-dynamic';

export default async function MentorshipSessionPage({ params }: { params: { sessionId: string } }) {
  const supabase = getServerSupabase();
  if (!supabase) {
    redirect('/dashboard');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/');
  }

  const { data: sessionData } = await supabase
    .from('mentorship_sessions')
    .select(
      'id, mentor_id, mentee_id, level, mentor:profiles(id, github_handle), mentee:profiles(id, github_handle)',
    )
    .eq('id', Number(params.sessionId))
    .maybeSingle();

  if (!sessionData) {
    redirect('/dashboard');
  }

  const mentorHandle = sessionData.mentor?.[0]?.github_handle ?? 'mentor';
  const menteeHandle = sessionData.mentee?.[0]?.github_handle ?? 'mentee';

  return (
    <div className="min-h-screen bg-[#111318] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Mentorship session</p>
              <h1 className="text-3xl font-semibold">Session #{params.sessionId}</h1>
            </div>
            <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-slate-300">
              Level {sessionData.level}
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Live mentorship chat with logs stored for transparency and maintainers.
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.8fr]">
          <ChatPanel
            sessionId={params.sessionId}
            currentUserId={user.id}
            mentorHandle={mentorHandle}
            menteeHandle={menteeHandle}
          />
          <MentorshipSessionsSidebar />
        </div>
      </div>
    </div>
  );
}
