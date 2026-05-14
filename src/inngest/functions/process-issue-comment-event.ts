import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

/**
 * Webhook handler for GitHub `issue_comment` events.
 *
 * Only bumps maintainer-side activity fields (comments_count, last_event_at)
 * so the triage classifier sees a recent event and doesn't flag the issue
 * as stale. Skips PR comments — issue_comment fires for both, but we already
 * have process-pr-event and process-review-event covering that side.
 */

type IssueCommentPayload = {
  action: 'created' | 'edited' | 'deleted' | string;
  issue: {
    number: number;
    comments: number;
    pull_request?: unknown;
  };
  repository: { full_name: string };
};

export const processIssueCommentEvent = inngest.createFunction(
  {
    id: 'process-issue-comment-event',
    concurrency: { key: 'event.data.payload.issue.number', limit: 1 },
  },
  { event: 'github/issue_comment' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: IssueCommentPayload }).payload;

    // Comments on PRs come through this same webhook — skip them, the PR
    // mirror handles its own activity tracking.
    if (payload.issue.pull_request) {
      return { skipped: true, reason: 'pr_comment' };
    }
    if (payload.action !== 'created' && payload.action !== 'deleted') {
      // edited doesn't change count or move the activity needle.
      return { skipped: true, action: payload.action };
    }

    return await step.run('bump-activity', async () => {
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true, reason: 'no_service_role' };

      // Only bump rows we already mirror. If the issue never came through
      // process-issue-event (e.g. comment on an issue opened pre-install)
      // the update is a no-op — fine, the triage view doesn't need it.
      const { error } = await sb
        .from('issues')
        .update({
          comments_count: payload.issue.comments,
          last_event_at: new Date().toISOString(),
        })
        .eq('repo_full_name', payload.repository.full_name)
        .eq('github_issue_number', payload.issue.number);

      if (error) return { error: error.message };
      return { ok: true, action: payload.action };
    });
  },
);
