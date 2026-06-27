import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function CourseProgress({ userId }: { userId: string }) {
  const service = getServiceSupabase();
  if (!service) return null;

  const [recsRes, prsRes, commentsRes] = await Promise.all([
    service
      .from('recommendations')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['claimed', 'completed'])
      .limit(1),
    service.from('pull_requests').select('id, state, merged_at').eq('author_user_id', userId),
    service.from('xp_events').select('id').eq('user_id', userId).eq('source', 'comment').limit(1),
  ]);

  const hasClaimedIssue = (recsRes.data?.length ?? 0) > 0;
  const hasOpenedPR = (prsRes.data?.length ?? 0) > 0;
  const hasCommented = (commentsRes.data?.length ?? 0) > 0;
  const hasMergedPR =
    prsRes.data?.some((pr) => pr.state === 'merged' || pr.merged_at !== null) ?? false;

  const STEPS = [
    { id: 1, title: 'Fork & clone a repository', done: hasClaimedIssue || hasOpenedPR },
    { id: 2, title: 'Make your first commit', done: hasOpenedPR },
    { id: 3, title: 'Open a pull request', done: hasOpenedPR },
    { id: 4, title: 'Respond to review feedback', done: hasCommented || hasMergedPR },
    { id: 5, title: 'Get your PR merged', done: hasMergedPR },
  ];

  const completedCount = STEPS.filter((s) => s.done).length;
  const nextStep = STEPS.find((s) => !s.done);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
          CONTRIBUTOR CURRICULUM
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          {completedCount}/{STEPS.length}
        </span>
      </div>

      <div className="mb-4 space-y-0">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 border-b border-zinc-800 py-3 last:border-0 ${
              step.done ? 'opacity-50' : ''
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00FF87]" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-zinc-600" />
            )}
            <span
              className={`text-[12px] ${step.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}
            >
              {step.title}
            </span>
            {!step.done && step.id === nextStep?.id && (
              <span className="ml-auto shrink-0 border border-amber-700/50 bg-amber-900/20 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-400">
                NEXT
              </span>
            )}
          </div>
        ))}
      </div>

      {nextStep && (
        <Link
          href="/issues"
          className="flex w-full items-center justify-center gap-2 border border-[#00FF87]/40 bg-[#10b981]/10 px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#00FF87] transition-colors hover:bg-[#10b981]/20"
        >
          CONTINUE COURSE <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </section>
  );
}
