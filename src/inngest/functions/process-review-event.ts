import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_REWARDS, XP_SOURCE, refIds } from '@/lib/xp/sources';

/**
 * Webhook handler for GitHub `pull_request_review` events.
 *
 * On `submitted` action:
 *   1. Substance check — body length or change_requested state (no lgtm-only XP)
 *   2. Match reviewer to a Mergeship profile
 *   3. Look up open help_requests on this PR
 *   4. UPSERT xp_events with bonuses:
 *      base + mentor (reviewer.level > mentee.level) + speed (responded <2h)
 *   5. Mark help_request resolved
 */

type ReviewPayload = {
  action: 'submitted' | 'edited' | 'dismissed' | string;
  review: {
    id: number;
    user: { login: string };
    body: string | null;
    state: 'approved' | 'changes_requested' | 'commented' | string;
    submitted_at: string;
  };
  pull_request: {
    html_url: string;
    number: number;
    user: { login: string };
    base: { repo: { full_name: string } };
  };
};

const SUBSTANCE_MIN_BODY = 20;
const SPEED_BONUS_HOURS = 2;

export function isSubstantive(review: ReviewPayload['review']): boolean {
  if (review.state === 'changes_requested') return true;
  const body = (review.body ?? '').trim();
  if (body.length < SUBSTANCE_MIN_BODY) return false;
  const lower = body.toLowerCase();
  if (lower === 'lgtm' || lower === 'looks good to me' || lower === 'looks good') return false;
  return true;
}

export const processReviewEvent = inngest.createFunction(
  {
    id: 'process-review-event',
    concurrency: { key: 'event.data.payload.review.id', limit: 1 },
  },
  { event: 'github/pull_request_review' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: ReviewPayload }).payload;
    if (payload.action !== 'submitted') return { skipped: true, action: payload.action };
    if (!isSubstantive(payload.review)) return { skipped: true, reason: 'not_substantive' };

    // Self-review block — author reviewing their own PR can't earn mentor XP.
    if (payload.review.user.login.toLowerCase() === payload.pull_request.user.login.toLowerCase()) {
      return { skipped: true, reason: 'self_review' };
    }

    return await step.run('award-help-review', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const { data: reviewer } = await sb
        .from('profiles')
        .select('id, level')
        .eq('github_handle', payload.review.user.login)
        .maybeSingle();
      if (!reviewer) return { skipped: true, reason: 'reviewer_not_in_mergeship' };

      const { data: helpReq } = await sb
        .from('help_requests')
        .select('id, user_id, created_at')
        .eq('pr_url', payload.pull_request.html_url)
        .eq('status', 'open')
        .maybeSingle();

      if (!helpReq) return { skipped: true, reason: 'no_open_help_request' };

      const { data: mentee } = await sb
        .from('profiles')
        .select('level')
        .eq('id', helpReq.user_id)
        .maybeSingle();
      const menteeLevel = mentee?.level ?? 0;

      let xp = XP_REWARDS.HELP_REVIEW_BASE;
      const isMentor = reviewer.level > menteeLevel;
      if (isMentor) xp += XP_REWARDS.HELP_REVIEW_MENTOR_BONUS;

      const responseMs =
        new Date(payload.review.submitted_at).getTime() - new Date(helpReq.created_at).getTime();
      const isFast = responseMs <= SPEED_BONUS_HOURS * 3600 * 1000;
      if (isFast) xp += XP_REWARDS.HELP_REVIEW_SPEED_BONUS;

      const inserted = await insertXpEvent({
        userId: reviewer.id,
        source: XP_SOURCE.HELP_REVIEW,
        refType: 'review',
        refId: refIds.helpReview(helpReq.id, payload.review.user.login),
        repo: payload.pull_request.base.repo.full_name,
        xpDelta: xp,
        metadata: { isMentor, isFast, menteeLevel },
      });

      if (inserted) {
        await sb
          .from('help_requests')
          .update({
            status: 'resolved',
            resolved_by: reviewer.id,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', helpReq.id);
      }

      return { xpAwarded: inserted ? xp : 0, isMentor, isFast };
    });
  },
);
