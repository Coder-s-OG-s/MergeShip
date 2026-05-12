import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { COURSE_MODULES, TOTAL_MODULES } from '@/lib/course/content';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const sb = getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen px-6 py-20 text-white">
        <h1 className="mb-4 font-display text-3xl font-bold">Onboarding</h1>
        <p className="text-gray-400">Auth not configured on this deployment.</p>
      </div>
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const { data: completed } = await sb
    .from('course_progress')
    .select('module_slug')
    .eq('user_id', user.id);
  const doneSlugs = new Set((completed ?? []).map((r) => r.module_slug));

  const completedCount = doneSlugs.size;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold">Foundational course</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Five short modules. Pass each quiz (80% or higher) to unlock the dashboard.
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>
                {completedCount} of {TOTAL_MODULES} done
              </span>
              {completedCount >= TOTAL_MODULES && (
                <Link href="/dashboard" className="text-purple-400 hover:underline">
                  Go to dashboard →
                </Link>
              )}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${(completedCount / TOTAL_MODULES) * 100}%` }}
              />
            </div>
          </div>
        </header>

        <ol className="space-y-3">
          {COURSE_MODULES.map((m) => {
            const isDone = doneSlugs.has(m.slug);
            return (
              <li
                key={m.slug}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Day {m.day}</div>
                    <h2 className="font-display text-lg font-semibold">{m.title}</h2>
                    <p className="mt-1 text-sm text-zinc-400">{m.blurb}</p>
                  </div>
                  {isDone && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
                      Done
                    </span>
                  )}
                </div>
                <Link
                  href={`/onboarding/${m.slug}`}
                  className="mt-3 inline-flex rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
                >
                  {isDone ? 'Review' : 'Start module'}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
