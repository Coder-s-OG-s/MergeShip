'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { XP_SOURCE, XP_REWARDS, refIds } from '@/lib/xp/sources';
import { insertXpEvent } from '@/lib/xp/events';
import { Result, ok, err } from '@/lib/result';
import { revalidatePath } from 'next/cache';

export async function verifyPrAction(opts: {
  prId?: number;
  prUrl?: string;
}): Promise<Result<{ xpAwarded: number }>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service missing');

  // Verify user is L2+
  const { data: mentor } = await service
    .from('profiles')
    .select('id, level, github_handle')
    .eq('id', user.id)
    .single();

  if (!mentor || mentor.level < 2) return err('not_authorised', 'Only L2+ users can verify PRs');

  // Resolve PR
  let prQuery = service
    .from('pull_requests')
    .select('id, author_user_id, repo_full_name, number, mentor_verified, author_login');
  if (opts.prId) {
    prQuery = prQuery.eq('id', opts.prId);
  } else if (opts.prUrl) {
    prQuery = prQuery.eq('url', opts.prUrl);
  } else {
    return err('invalid_input', 'Must provide prId or prUrl');
  }

  const { data: pr } = await prQuery.maybeSingle();
  if (!pr) return err('not_found', 'PR not found');
  if (pr.mentor_verified) return err('already_verified', 'This PR is already verified');
  if (pr.author_user_id === user.id)
    return err('cannot_verify_own', 'Mentors cannot verify their own PRs');

  // Mark PR verified
  const { error: updateErr } = await service
    .from('pull_requests')
    .update({
      mentor_verified: true,
      mentor_reviewer_id: user.id,
      mentor_review_at: new Date().toISOString(),
    })
    .eq('id', pr.id);

  if (updateErr) return err('persist_failed', updateErr.message);

  // Award XP
  const { data: mentee } = await service
    .from('profiles')
    .select('level')
    .eq('id', pr.author_user_id)
    .maybeSingle();

  const menteeLevel = mentee?.level ?? 0;
  const isMentor = mentor.level > menteeLevel;

  let xp = XP_REWARDS.HELP_REVIEW_BASE;
  if (isMentor) xp += XP_REWARDS.HELP_REVIEW_MENTOR_BONUS;

  // Exclude speed bonus for manual verification
  const inserted = await insertXpEvent({
    userId: user.id,
    source: XP_SOURCE.HELP_REVIEW,
    refType: 'review',
    // Ensure refId is unique per PR and mentor
    refId: refIds.helpReview(pr.id, mentor.github_handle),
    repo: pr.repo_full_name,
    xpDelta: xp,
    metadata: { isMentor, menteeLevel, manual_verify: true },
  });

  revalidatePath('/maintainer');
  revalidatePath('/issues');

  return ok({ xpAwarded: inserted ? xp : 0 });
}
