'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { XP_REWARDS, XP_SOURCE } from '@/lib/xp/sources';
import { unwrapJoin } from '@/lib/supabase/inner-join';

export type XpPreviewBreakdown = {
  author: {
    userId: string | null;
    login: string;
    xp: number;
    status: 'recommended' | 'unrecommended' | 'self_merge';
  };
  reviewers: Array<{
    userId: string | null;
    login: string;
    xp: number;
    isMentor: boolean;
  }>;
};

const ISSUE_REF = /(?:close[sd]?|fixe[sd]?|resolve[sd]?)\s+#(\d+)/gi;

function extractIssueNumbers(text: string | null | undefined): number[] {
  if (!text) return [];
  const found = new Set<number>();
  for (const m of text.matchAll(ISSUE_REF)) {
    const n = parseInt(m[1] ?? '', 10);
    if (Number.isFinite(n)) found.add(n);
  }
  return [...found];
}

export async function previewMergeXp(prId: number): Promise<Result<XpPreviewBreakdown>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:xp-preview', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // 1. Fetch PR details
  const { data: rawPr, error: rawPrErr } = await service
    .from('pull_requests')
    .select(
      'id, repo_full_name, number, title, url, state, author_login, author_user_id, mentor_verified, mentor_reviewer_id, github_updated_at, ai_flagged, body_excerpt',
    )
    .eq('id', prId)
    .maybeSingle();

  if (rawPrErr) return err('db_error', rawPrErr.message);
  if (!rawPr) return err('not_found', 'PR not found');

  // 2. Authorisation check
  const { data: repoRow, error: repoErr } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', rawPr.repo_full_name)
    .maybeSingle();

  if (repoErr) return err('db_error', repoErr.message);
  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }

  const scoped = await listMaintainerRepos(user.id, repoRow.installation_id);
  if (!scoped.includes(rawPr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  // 3. Determine if recommended merge exists
  let matchedRec: {
    id: number;
    difficulty: string;
    xp_reward: number | null;
  } | null = null;

  // First try recommendations directly linked to the PR URL
  const { data: rec } = await service
    .from('recommendations')
    .select('id, user_id, difficulty, xp_reward, status')
    .eq('linked_pr_url', rawPr.url)
    .maybeSingle();

  if (rec) {
    matchedRec = rec;
  } else if (rawPr.author_user_id) {
    // Fallback: match by issue references in PR title or description body
    const issueRefs = [
      ...extractIssueNumbers(rawPr.body_excerpt),
      ...extractIssueNumbers(rawPr.title),
    ];
    if (issueRefs.length > 0) {
      const { data: claims } = await service
        .from('recommendations')
        .select(
          'id, difficulty, xp_reward, status, issues!inner(repo_full_name, github_issue_number)',
        )
        .eq('user_id', rawPr.author_user_id)
        .in('status', ['open', 'claimed']);

      for (const claim of claims ?? []) {
        const issue = unwrapJoin<{ repo_full_name?: string; github_issue_number?: number }>(
          (claim as unknown as { issues: unknown }).issues,
        );
        if (
          issue &&
          issue.repo_full_name === rawPr.repo_full_name &&
          typeof issue.github_issue_number === 'number' &&
          issueRefs.includes(issue.github_issue_number)
        ) {
          matchedRec = {
            id: claim.id,
            difficulty: claim.difficulty,
            xp_reward: claim.xp_reward,
          };
          break;
        }
      }
    }
  }

  // Calculate Author XP
  let authorXp = 0;
  let authorStatus: 'recommended' | 'unrecommended' | 'self_merge' = 'unrecommended';

  const repoOwner = rawPr.repo_full_name.split('/')[0]?.toLowerCase();
  const authorLogin = rawPr.author_login.toLowerCase();

  if (repoOwner === authorLogin) {
    authorXp = 0;
    authorStatus = 'self_merge';
  } else if (matchedRec) {
    const difficulty = matchedRec.difficulty as 'E' | 'M' | 'H';
    const tierCap = XP_REWARDS.RECOMMENDED_MERGE[difficulty];
    authorXp = Math.min(matchedRec.xp_reward ?? tierCap, tierCap);
    authorStatus = 'recommended';
  } else {
    authorXp = XP_REWARDS.UNRECOMMENDED_MERGE;
    authorStatus = 'unrecommended';
  }

  // 4. Calculate Reviewer XP
  // Fetch help requests for the PR
  const { data: helpReq } = await service
    .from('help_requests')
    .select('id, created_at, status, resolved_by, resolved_at')
    .eq('pr_url', rawPr.url)
    .in('status', ['open', 'resolved'])
    .maybeSingle();

  // Fetch pull request reviews
  const { data: reviews } = await service
    .from('pull_request_reviews')
    .select('reviewer_user_id, reviewer_login, is_mentor, submitted_at')
    .eq('pr_id', rawPr.id);

  const reviewers: Array<{
    userId: string | null;
    login: string;
    xp: number;
    isMentor: boolean;
  }> = [];

  if (helpReq) {
    let matchingReviewerId: string | null = null;
    let matchingReviewerLogin: string | null = null;
    let isMentor = false;
    let submittedAt: string | null = null;

    if (helpReq.status === 'resolved' && helpReq.resolved_by) {
      // Find the review by the resolver
      const resolverReview = (reviews ?? []).find(
        (r) => r.reviewer_user_id === helpReq.resolved_by,
      );

      if (resolverReview) {
        matchingReviewerId = resolverReview.reviewer_user_id;
        matchingReviewerLogin = resolverReview.reviewer_login;
        isMentor = resolverReview.is_mentor;
        submittedAt = resolverReview.submitted_at;
      } else {
        // Fallback if resolved by someone without a DB review row (e.g. manual verify profile check)
        const { data: resolverProfile } = await service
          .from('profiles')
          .select('github_handle')
          .eq('id', helpReq.resolved_by)
          .maybeSingle();
        if (resolverProfile) {
          matchingReviewerId = helpReq.resolved_by;
          matchingReviewerLogin = resolverProfile.github_handle;
          isMentor = false; // default fallback
          submittedAt = helpReq.resolved_at;
        }
      }
    } else if (helpReq.status === 'open') {
      // Find the earliest review submitted after helpReq.created_at
      const validReviews = (reviews ?? [])
        .filter(
          (r) =>
            r.submitted_at &&
            new Date(r.submitted_at).getTime() >= new Date(helpReq.created_at).getTime(),
        )
        .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());

      const earliest = validReviews[0];
      if (earliest) {
        matchingReviewerId = earliest.reviewer_user_id;
        matchingReviewerLogin = earliest.reviewer_login;
        isMentor = earliest.is_mentor;
        submittedAt = earliest.submitted_at;
      }
    }

    if (matchingReviewerLogin) {
      let reviewerXp = XP_REWARDS.HELP_REVIEW_BASE; // 30
      if (isMentor) {
        reviewerXp += XP_REWARDS.HELP_REVIEW_MENTOR_BONUS; // 25
      }

      if (submittedAt) {
        const responseMs = new Date(submittedAt).getTime() - new Date(helpReq.created_at).getTime();
        const isFast = responseMs <= 2 * 3600 * 1000; // responded < 2h
        if (isFast) {
          reviewerXp += XP_REWARDS.HELP_REVIEW_SPEED_BONUS; // 10
        }
      }

      reviewers.push({
        userId: matchingReviewerId,
        login: matchingReviewerLogin,
        xp: reviewerXp,
        isMentor,
      });
    }
  }

  return ok({
    author: {
      userId: rawPr.author_user_id,
      login: rawPr.author_login,
      xp: authorXp,
      status: authorStatus,
    },
    reviewers,
  });
}
