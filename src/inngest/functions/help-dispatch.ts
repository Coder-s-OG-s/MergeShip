import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { rankReviewers, type ReviewerCandidate } from '@/lib/help/dispatch';

/**
 * Help dispatch: when a user fires a help request, fan out notifications to
 * L2+ reviewers per the dispatch rings.
 *
 * For Phase 3 we write notification rows to the activity_log keyed to the
 * reviewer; a future web-push integration reads from there.
 */
type HelpDispatchEvent = {
  data: { helpRequestId: number; userId: string; prUrl: string };
};

export const helpDispatch = inngest.createFunction(
  { id: 'help-dispatch', concurrency: { key: 'event.data.helpRequestId', limit: 1 } },
  { event: 'help/dispatch' },
  async ({ event, step }) => {
    const { helpRequestId, userId } = (event as HelpDispatchEvent).data;

    const dispatched = await step.run('rank-and-notify', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const { data: mentee } = await sb
        .from('profiles')
        .select('level, primary_language')
        .eq('id', userId)
        .maybeSingle();
      const menteeLevel = mentee?.level ?? 0;
      const menteeLang = mentee?.primary_language ?? null;

      const { data: cohortRow } = await sb
        .from('cohort_members')
        .select('cohort_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      const cohortId = cohortRow?.cohort_id ?? null;

      // Pool: all L2+ profiles. In production we'd narrow by recent activity etc.
      const { data: pool } = await sb
        .from('profiles')
        .select('id, level, primary_language')
        .gte('level', 2)
        .neq('id', userId);

      // Cohort lookup for each pool member.
      let inCohort = new Set<string>();
      if (cohortId !== null) {
        const { data: members } = await sb
          .from('cohort_members')
          .select('user_id')
          .eq('cohort_id', cohortId);
        inCohort = new Set((members ?? []).map((m) => m.user_id));
      }

      const candidates: ReviewerCandidate[] = (pool ?? []).map((p) => ({
        userId: p.id,
        level: p.level,
        sameOrgReviewed: false, // computed from review history in phase 4
        sameCohort: inCohort.has(p.id),
        languageMatch: !!menteeLang && p.primary_language === menteeLang,
      }));

      const targets = rankReviewers(candidates, { menteeLevel });

      if (targets.length === 0) return { notified: 0 };

      // Write a notification row per target for the help-inbox to pick up.
      const rows = targets.map((t) => ({
        user_id: t.userId,
        kind: 'help_dispatch',
        detail: { helpRequestId, fromUserId: userId } as never,
      }));
      await sb.from('activity_log').insert(rows);

      return { notified: targets.length };
    });

    return { helpRequestId, ...dispatched };
  },
);
