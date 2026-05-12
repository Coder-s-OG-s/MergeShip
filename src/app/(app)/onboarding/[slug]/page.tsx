import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { moduleBySlug } from '@/lib/course/content';
import ModuleQuiz from './quiz';

export const dynamic = 'force-dynamic';

export default async function ModulePage({ params }: { params: { slug: string } }) {
  const mod = moduleBySlug(params.slug);
  if (!mod) notFound();

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

  const { data: existing } = await sb
    .from('course_progress')
    .select('quiz_score')
    .eq('user_id', user.id)
    .eq('module_slug', mod.slug)
    .maybeSingle();

  return (
    <article className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/onboarding" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← back to course
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold">{mod.title}</h1>
        <p className="mt-2 text-zinc-400">{mod.blurb}</p>

        <div className="mt-8 whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-200">
          {mod.body}
        </div>

        <ModuleQuiz slug={mod.slug} quiz={mod.quiz} previousScore={existing?.quiz_score ?? null} />
      </div>
    </article>
  );
}
