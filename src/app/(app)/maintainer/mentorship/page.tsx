import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type ProfileLink = { github_handle: string | null; display_name: string | null };

type SessionRow = {
  id: number;
  level: number;
  started_at: string;
  ended_at: string | null;
  mentor: ProfileLink[] | null;
  mentee: ProfileLink[] | null;
};

export default async function MaintainerMentorshipPage() {
  const supabase = getServerSupabase();
  if (!supabase) {
    redirect('/dashboard');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const service = getServiceSupabase();
  if (!service) {
    return <div className="p-8 text-white">Supabase service client not configured.</div>;
  }

  const { data: sessions } = await service
    .from('mentorship_sessions')
    .select(
      'id, level, started_at, ended_at, mentor:profiles(github_handle, display_name), mentee:profiles(github_handle, display_name)',
    )
    .order('started_at', { ascending: false });

  return (
    <div className="min-h-screen bg-[#111318] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-3xl border border-slate-800 bg-slate-950 p-8">
          <h1 className="text-3xl font-semibold">Mentorship session logs</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review past mentorship sessions, audit transcripts, and export logs as JSON or CSV.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/mentorship/logs?format=json"
              className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Export JSON
            </a>
            <a
              href="/api/mentorship/logs?format=csv"
              className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Export CSV
            </a>
          </div>
        </header>

        <div className="space-y-4">
          {(sessions ?? []).map((session: SessionRow) => {
            const mentor = session.mentor?.[0];
            const mentee = session.mentee?.[0];

            return (
              <div
                key={session.id}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Session #{session.id}</h2>
                    <p className="text-sm text-slate-400">
                      Mentor: {mentor?.display_name ?? mentor?.github_handle ?? 'Unknown'} · Mentee:{' '}
                      {mentee?.display_name ?? mentee?.github_handle ?? 'Unknown'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-widest text-slate-400">
                    Level {session.level}
                  </span>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  Started {new Date(session.started_at).toLocaleString()} · Ended{' '}
                  {session.ended_at ? new Date(session.ended_at).toLocaleString() : 'active'}
                </div>
              </div>
            );
          })}
          {(sessions ?? []).length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-500">
              No mentorship sessions recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
