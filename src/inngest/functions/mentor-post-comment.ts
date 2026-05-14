import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import { buildMentorCommentBody, decideMentorCommentAction } from '@/lib/maintainer/mentor-comment';

/**
 * Posts (or updates) the "Reviewed by MergeShip mentor" comment on a PR
 * once process-review-event flips pull_requests.mentor_verified.
 *
 * Decoupled from the review handler:
 *  - GitHub API failures here can't roll back the flag in our DB
 *  - Retries reuse the same mentor_comment_id so we never spam the PR
 *
 * Idempotency:
 *  - Stores the comment id on pull_requests.mentor_comment_id
 *  - decideMentorCommentAction prevents reposting on same-level reviews
 *  - Skips entirely on closed/merged/draft PRs
 */

type Event = { data: { prId: number; reviewerId: string } };

export const mentorPostComment = inngest.createFunction(
  { id: 'mentor-post-comment', concurrency: { key: 'event.data.prId', limit: 1 } },
  { event: 'mentor/post-comment' },
  async ({ event, step }) => {
    return await step.run('post-or-update', async () => {
      const { prId, reviewerId } = (event as Event).data;
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true, reason: 'no_service_role' };

      // Load PR + reviewer state.
      const { data: pr } = await sb
        .from('pull_requests')
        .select('id, repo_full_name, number, draft, state, mentor_comment_id, mentor_reviewer_id')
        .eq('id', prId)
        .maybeSingle();
      if (!pr) return { skipped: true, reason: 'pr_not_found' };

      const { data: reviewer } = await sb
        .from('profiles')
        .select('id, github_handle, level')
        .eq('id', reviewerId)
        .maybeSingle();
      if (!reviewer) return { skipped: true, reason: 'reviewer_not_found' };

      // Look up the existing mentor level (whoever is on the row right now —
      // could be the same reviewer if this is a replay, or an older one if a
      // higher-level reviewer just landed).
      let existingMentorLevel: number | null = null;
      if (pr.mentor_reviewer_id) {
        const { data: m } = await sb
          .from('profiles')
          .select('level')
          .eq('id', pr.mentor_reviewer_id)
          .maybeSingle();
        existingMentorLevel = m?.level ?? null;
      }

      const action = decideMentorCommentAction({
        isDraft: pr.draft === true,
        state: pr.state as 'open' | 'closed' | 'merged',
        existingCommentId: pr.mentor_comment_id ?? null,
        existingMentorLevel,
        newMentorLevel: reviewer.level,
      });

      if (action === 'skip') {
        return { skipped: true, action: 'skip' };
      }

      const [owner, repoName] = pr.repo_full_name.split('/');
      if (!owner || !repoName) return { skipped: true, reason: 'bad_repo_name' };

      // Find the install token for this repo.
      const { data: installRow } = await sb
        .from('installation_repositories')
        .select('installation_id')
        .eq('repo_full_name', pr.repo_full_name)
        .limit(1)
        .maybeSingle();
      if (!installRow) return { skipped: true, reason: 'no_install_for_repo' };

      let octokit;
      try {
        octokit = await getInstallOctokit(installRow.installation_id as number);
      } catch (e) {
        await logError(sb, reviewer.id, prId, `install-token: ${(e as Error).message}`);
        return { skipped: true, reason: 'install_token_failed' };
      }

      const body = buildMentorCommentBody({
        reviewerHandle: reviewer.github_handle,
        reviewerLevel: reviewer.level,
      });

      try {
        if (action === 'post') {
          const res = await octokit.issues.createComment({
            owner,
            repo: repoName,
            issue_number: pr.number,
            body,
          });
          await sb.from('pull_requests').update({ mentor_comment_id: res.data.id }).eq('id', prId);

          await sb.from('activity_log').insert({
            user_id: reviewer.id,
            kind: 'mentor_comment_posted',
            detail: { prId, commentId: res.data.id, repo: pr.repo_full_name, number: pr.number },
          });

          return { action: 'post', commentId: res.data.id };
        }

        // action === 'update'
        await octokit.issues.updateComment({
          owner,
          repo: repoName,
          comment_id: pr.mentor_comment_id as number,
          body,
        });

        await sb.from('activity_log').insert({
          user_id: reviewer.id,
          kind: 'mentor_comment_posted',
          detail: {
            prId,
            commentId: pr.mentor_comment_id,
            updated: true,
            repo: pr.repo_full_name,
            number: pr.number,
          },
        });

        return { action: 'update', commentId: pr.mentor_comment_id };
      } catch (e) {
        const msg = (e as Error).message;
        await logError(sb, reviewer.id, prId, msg);
        // Don't throw — flag stays set, comment will be retried by a future
        // higher-level review or manual re-fire. Throwing would cause Inngest
        // to retry the whole step which is fine, but logging + returning is
        // cleaner so we don't bombard the comment endpoint.
        return { error: msg };
      }
    });
  },
);

async function logError(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string,
  prId: number,
  message: string,
): Promise<void> {
  try {
    await sb.from('activity_log').insert({
      user_id: userId,
      kind: 'mentor_comment_error',
      detail: { prId, error: message },
    });
  } catch {
    // Logging failure is non-fatal.
  }
}
