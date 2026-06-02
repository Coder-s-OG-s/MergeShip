import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processIssueCommentEvent } from './process-issue-comment-event';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = processIssueCommentEvent as unknown as (ctx: {
  event: { data: { payload: Record<string, unknown> } };
  step: typeof step;
}) => Promise<unknown>;

const ev = (action: string, pullRequest?: unknown) => ({
  data: {
    payload: {
      action,
      issue: {
        number: 42,
        comments: 5,
        pull_request: pullRequest,
      },
      repository: { full_name: 'test-org/repo-1' },
    },
  },
});

describe('processIssueCommentEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bumps comments count and updates last_event_at for standard issue comment', async () => {
    const issues = sb({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    });
    wire({ issues });

    const result = await run({ event: ev('created'), step });

    expect(issues.update).toHaveBeenCalledWith(
      expect.objectContaining({
        comments_count: 5,
        last_event_at: expect.any(String),
      }),
    );
    expect(issues.eq).toHaveBeenCalledWith('repo_full_name', 'test-org/repo-1');
    expect(issues.eq).toHaveBeenCalledWith('github_issue_number', 42);
    expect(result).toEqual({ ok: true, action: 'created' });
  });

  it('ignores PR comments completely', async () => {
    const result = await run({ event: ev('created', {}), step }); // pass empty object for pull_request
    expect(result).toEqual({ skipped: true, reason: 'pr_comment' });
  });

  it('ignores irrelevant actions like edited', async () => {
    const result = await run({ event: ev('edited'), step });
    expect(result).toEqual({ skipped: true, action: 'edited' });
  });
});
