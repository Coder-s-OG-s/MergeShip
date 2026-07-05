import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processIssueEvent } from './process-issue-event';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));

vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = processIssueEvent as unknown as (ctx: {
  event: { data: { payload: Record<string, unknown> } };
  step: typeof step;
}) => Promise<unknown>;

const ev = (action: string, pullRequest?: unknown) => ({
  data: {
    payload: {
      action,
      issue: {
        id: 1234,
        number: 42,
        title: 'Test Issue',
        body: 'Issue description',
        state: action === 'closed' ? 'closed' : 'open',
        html_url: 'https://github.com/test-org/repo-1/issues/42',
        user: { login: 'alice' },
        assignee: { login: 'bob' },
        labels: [{ name: 'bug' }],
        comments: 2,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2020-01-02T00:00:00Z',
        closed_at: action === 'closed' ? '2020-01-03T00:00:00Z' : null,
        pull_request: pullRequest,
      },
      repository: { full_name: 'test-org/repo-1' },
    },
  },
});

describe('processIssueEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts issue on opened action', async () => {
    const issues = sb({ upsert: vi.fn().mockResolvedValue({}) });
    wire({ issues });

    const result = await run({ event: ev('opened'), step });

    expect(issues.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        repo_full_name: 'test-org/repo-1',
        github_issue_number: 42,
        title: 'Test Issue',
        state: 'open',
        assignee_login: 'bob',
        labels: ['bug'],
      }),
      { onConflict: 'repo_full_name,github_issue_number' },
    );
    expect(result).toEqual({ ok: true, action: 'opened' });
  });

  it('upserts issue on closed action', async () => {
    const issues = sb({ upsert: vi.fn().mockResolvedValue({}) });
    wire({ issues });

    const result = await run({ event: ev('closed'), step });

    expect(issues.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'closed',
        closed_at: '2020-01-03T00:00:00Z',
      }),
      { onConflict: 'repo_full_name,github_issue_number' },
    );
    expect(result).toEqual({ ok: true, action: 'closed' });
  });

  it('ignores irrelevant actions like transferred', async () => {
    const result = await run({ event: ev('transferred'), step });
    expect(result).toEqual({ skipped: true, action: 'transferred' });
  });

  it('ignores events that are actually pull requests', async () => {
    const result = await run({ event: ev('opened', {}), step });
    expect(result).toEqual({ skipped: true, reason: 'is_pr' });
  });
});
