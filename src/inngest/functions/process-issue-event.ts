import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

/**
 * Webhook handler for GitHub `issues` events.
 *
 * Mirrors the issue into our `issues` table so the maintainer triage view
 * has fresh assignee/label/state data without polling. The contributor-side
 * rec pipeline also writes to this table — both keyed on (repo, number) —
 * so we UPSERT and only touch maintainer-side columns here.
 *
 * Actions handled: opened, edited, labeled, unlabeled, assigned, unassigned,
 * closed, reopened. Other actions (transferred, pinned, etc) are ignored.
 */

type IssuePayload = {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: 'open' | 'closed';
    html_url: string;
    user: { login: string };
    assignee: { login: string } | null;
    labels: Array<{ name: string }>;
    comments: number;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    pull_request?: unknown; // issue_comment fires for PRs too — guard against
  };
  repository: { full_name: string };
};

const RELEVANT_ACTIONS = new Set([
  'opened',
  'edited',
  'labeled',
  'unlabeled',
  'assigned',
  'unassigned',
  'closed',
  'reopened',
]);

export const processIssueEvent = inngest.createFunction(
  {
    id: 'process-issue-event',
    concurrency: { key: 'event.data.payload.issue.id', limit: 1 },
  },
  { event: 'github/issues' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: IssuePayload }).payload;

    if (!RELEVANT_ACTIONS.has(payload.action)) {
      return { skipped: true, action: payload.action };
    }
    // Defensive: a real `issues` event never carries pull_request, but skip
    // anyway so we don't pollute the table if GitHub ever changes shape.
    if (payload.issue.pull_request) {
      return { skipped: true, reason: 'is_pr' };
    }

    return await step.run('upsert-issue', async () => {
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true, reason: 'no_service_role' };

      const issue = payload.issue;
      const row = {
        repo_full_name: payload.repository.full_name,
        github_issue_number: issue.number,
        github_issue_id: issue.id,
        title: issue.title,
        body_excerpt: (issue.body ?? '').slice(0, 500),
        url: issue.html_url,
        state: issue.state,
        labels: issue.labels.map((l) => l.name),
        author_login: issue.user.login,
        assignee_login: issue.assignee?.login ?? null,
        comments_count: issue.comments,
        closed_at: issue.closed_at,
        github_created_at: issue.created_at,
        github_updated_at: issue.updated_at,
        last_event_at: new Date().toISOString(),
      };

      const { error } = await sb.from('issues').upsert(row, {
        onConflict: 'repo_full_name,github_issue_number',
      });
      if (error) {
        return { error: error.message };
      }
      return { ok: true, action: payload.action };
    });
  },
);
