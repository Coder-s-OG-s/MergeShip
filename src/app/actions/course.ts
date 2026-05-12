'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { gradeQuiz } from '@/lib/course/grade';
import { moduleBySlug, TOTAL_MODULES } from '@/lib/course/content';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_REWARDS, XP_SOURCE, refIds } from '@/lib/xp/sources';
import { rateLimit } from '@/lib/rate-limit';

type CompleteOutput = {
  score: number;
  passed: boolean;
  totalCompleted: number;
  courseFinished: boolean;
  xpAwarded: number;
};

export async function completeCourseModule(
  moduleSlug: string,
  answers: Record<string, number>,
): Promise<Result<CompleteOutput>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const limited = await rateLimit({
    namespace: 'course:complete',
    key: user.id,
    limit: 20,
    windowSec: 60,
  });
  if (!limited.ok) return err('rate_limited', 'slow down', true);

  const mod = moduleBySlug(moduleSlug);
  if (!mod) return err('not_found', `unknown module: ${moduleSlug}`);

  const grade = gradeQuiz(mod, answers);
  if (!grade.passed) {
    return ok({
      score: grade.score,
      passed: false,
      totalCompleted: await countCompleted(service, user.id),
      courseFinished: false,
      xpAwarded: 0,
    });
  }

  // UPSERT progress — re-passing the same module doesn't double-credit.
  const { error: progErr } = await service.from('course_progress').upsert(
    {
      user_id: user.id,
      module_slug: mod.slug,
      quiz_score: grade.score,
    },
    { onConflict: 'user_id,module_slug' },
  );
  if (progErr) return err('persist_failed', progErr.message);

  // Award per-module XP. Idempotent via UNIQUE on xp_events.
  let xpAwarded = 0;
  const moduleInserted = await insertXpEvent({
    userId: user.id,
    source: XP_SOURCE.COURSE_MODULE_COMPLETED,
    refType: 'course_module',
    refId: refIds.courseModule(mod.slug),
    xpDelta: XP_REWARDS.COURSE_MODULE,
    metadata: { score: grade.score },
  });
  if (moduleInserted) xpAwarded += XP_REWARDS.COURSE_MODULE;

  const totalCompleted = await countCompleted(service, user.id);
  let courseFinished = false;
  if (totalCompleted >= TOTAL_MODULES) {
    const finishInserted = await insertXpEvent({
      userId: user.id,
      source: XP_SOURCE.COURSE_COMPLETED,
      refType: 'course',
      refId: refIds.course(),
      xpDelta: XP_REWARDS.COURSE_COMPLETED,
    });
    if (finishInserted) xpAwarded += XP_REWARDS.COURSE_COMPLETED;
    courseFinished = true;
  }

  return ok({
    score: grade.score,
    passed: true,
    totalCompleted,
    courseFinished,
    xpAwarded,
  });
}

async function countCompleted(
  service: ReturnType<typeof getServiceSupabase>,
  userId: string,
): Promise<number> {
  if (!service) return 0;
  const { count } = await service
    .from('course_progress')
    .select('module_slug', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}
