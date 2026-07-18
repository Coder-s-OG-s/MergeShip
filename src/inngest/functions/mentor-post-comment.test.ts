import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstallOctokit } from '@/lib/github/app';
import { buildMentorCommentBody, decideMentorCommentAction } from '@/lib/maintainer/mentor-comment';
import { mentorPostComment } from './mentor-post-comment';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/github/app', () => ({ getInstallOctokit: vi.fn() }));
vi.mock('@/lib/maintainer/mentor-comment', () => ({
  buildMentorCommentBody: vi.fn(),
  decideMentorCommentAction: vi.fn(),
}));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = mentorPostComment as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

const ev = (over: Record<string, unknown> = {}) => ({
  data: { prId: 101, reviewerId: 'u1', ...over },
});

describe('mentorPostComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts a new comment via GitHub API when no comment exists', async () => {
    const pull_requests = sb({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 101,
          repo_full_name: 'test-org/repo-1',
          number: 1,
          draft: false,
          state: 'open',
          mentor_comment_id: null,
          mentor_reviewer_id: null,
        },
      }),
      update: vi.fn().mockReturnThis(),
    });

    const activity_log = sb({ insert: vi.fn().mockResolvedValue({}) });

    wire({
      pull_requests,
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'u1', github_handle: 'alice', level: 2 },
        }),
      }),
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { installation_id: 1 } }),
      }),
      activity_log,
    });

    const octokit = {
      issues: {
        createComment: vi.fn().mockResolvedValue({ data: { id: 999 } }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideMentorCommentAction).mockReturnValue('post');
    vi.mocked(buildMentorCommentBody).mockReturnValue('Review body');

    const result = await run({ event: ev(), step });

    expect(octokit.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-org',
      repo: 'repo-1',
      issue_number: 1,
      body: 'Review body',
    });
    expect(pull_requests.update).toHaveBeenCalledWith({ mentor_comment_id: 999 });
    expect(activity_log.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'mentor_comment_posted' }),
    );
    expect(result).toEqual({ action: 'post', commentId: 999 });
  });

  it('updates existing comment via GitHub API when updating', async () => {
    wire({
      pull_requests: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 101,
            repo_full_name: 'test-org/repo-1',
            number: 1,
            draft: false,
            state: 'open',
            mentor_comment_id: 999,
            mentor_reviewer_id: 'u1',
          },
        }),
      }),
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'u1', github_handle: 'alice', level: 3 },
        }),
      }),
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { installation_id: 1 } }),
      }),
      activity_log: sb({ insert: vi.fn().mockResolvedValue({}) }),
    });

    const octokit = {
      issues: {
        updateComment: vi.fn().mockResolvedValue({ data: { id: 999 } }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideMentorCommentAction).mockReturnValue('update');
    vi.mocked(buildMentorCommentBody).mockReturnValue('Updated review body');

    const result = await run({ event: ev(), step });

    expect(octokit.issues.updateComment).toHaveBeenCalledWith({
      owner: 'test-org',
      repo: 'repo-1',
      comment_id: 999,
      body: 'Updated review body',
    });
    expect(result).toEqual({ action: 'update', commentId: 999 });
  });

  it('prefers previousReviewerId from event payload to fetch the existing mentor level', async () => {
    const eqMock = vi.fn().mockReturnThis();
    const maybeSingleMock = vi.fn().mockImplementation(async () => {
      // Find the argument of the last call to eq
      const calls = eqMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      const idSearched = lastCall ? lastCall[1] : null;

      if (idSearched === 'u_new') {
        return { data: { id: 'u_new', github_handle: 'bob', level: 3 } };
      } else if (idSearched === 'u_prev') {
        return { data: { id: 'u_prev', github_handle: 'alice', level: 2 } };
      }
      return { data: null };
    });

    const profilesMock = sb({
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      maybeSingle: maybeSingleMock,
    });

    wire({
      pull_requests: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 101,
            repo_full_name: 'test-org/repo-1',
            number: 1,
            draft: false,
            state: 'open',
            mentor_comment_id: 999,
            mentor_reviewer_id: 'u_new', // Already overwritten in DB
          },
        }),
      }),
      profiles: profilesMock,
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { installation_id: 1 } }),
      }),
      activity_log: sb({ insert: vi.fn().mockResolvedValue({}) }),
    });

    const octokit = {
      issues: {
        updateComment: vi.fn().mockResolvedValue({ data: { id: 999 } }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideMentorCommentAction).mockReturnValue('update');
    vi.mocked(buildMentorCommentBody).mockReturnValue('Updated review body');

    const result = await run({
      event: ev({ reviewerId: 'u_new', previousReviewerId: 'u_prev' }),
      step,
    });

    expect(eqMock).toHaveBeenCalledWith('id', 'u_prev');
    expect(eqMock).toHaveBeenCalledWith('id', 'u_new');
    expect(decideMentorCommentAction).toHaveBeenCalledWith(
      expect.objectContaining({
        existingMentorLevel: 2,
        newMentorLevel: 3,
      }),
    );
    expect(result).toEqual({ action: 'update', commentId: 999 });
  });

  it('falls back to pull_requests.mentor_reviewer_id when previousReviewerId is omitted', async () => {
    const eqMock = vi.fn().mockReturnThis();
    const maybeSingleMock = vi.fn().mockImplementation(async () => {
      const calls = eqMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      const idSearched = lastCall ? lastCall[1] : null;

      if (idSearched === 'u_new') {
        return { data: { id: 'u_new', github_handle: 'bob', level: 3 } };
      } else if (idSearched === 'u_prev') {
        return { data: { id: 'u_prev', github_handle: 'alice', level: 2 } };
      }
      return { data: null };
    });

    const profilesMock = sb({
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      maybeSingle: maybeSingleMock,
    });

    wire({
      pull_requests: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 101,
            repo_full_name: 'test-org/repo-1',
            number: 1,
            draft: false,
            state: 'open',
            mentor_comment_id: 999,
            mentor_reviewer_id: 'u_prev', // The previous mentor is still in the DB
          },
        }),
      }),
      profiles: profilesMock,
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { installation_id: 1 } }),
      }),
      activity_log: sb({ insert: vi.fn().mockResolvedValue({}) }),
    });

    const octokit = {
      issues: {
        updateComment: vi.fn().mockResolvedValue({ data: { id: 999 } }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideMentorCommentAction).mockReturnValue('update');
    vi.mocked(buildMentorCommentBody).mockReturnValue('Updated review body');

    const result = await run({
      event: ev({ reviewerId: 'u_new' }), // previousReviewerId is omitted
      step,
    });

    expect(eqMock).toHaveBeenCalledWith('id', 'u_prev');
    expect(eqMock).toHaveBeenCalledWith('id', 'u_new');
    expect(decideMentorCommentAction).toHaveBeenCalledWith(
      expect.objectContaining({
        existingMentorLevel: 2,
        newMentorLevel: 3,
      }),
    );
    expect(result).toEqual({ action: 'update', commentId: 999 });
  });

  it('fails safely when github api returns error', async () => {
    const activity_log = sb({ insert: vi.fn().mockResolvedValue({}) });
    wire({
      pull_requests: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 101,
            repo_full_name: 'test-org/repo-1',
            number: 1,
            draft: false,
            state: 'open',
            mentor_comment_id: null,
            mentor_reviewer_id: null,
          },
        }),
      }),
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'u1', github_handle: 'alice', level: 2 },
        }),
      }),
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { installation_id: 1 } }),
      }),
      activity_log,
    });

    const octokit = {
      issues: {
        createComment: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideMentorCommentAction).mockReturnValue('post');

    const result = await run({ event: ev(), step });

    expect(activity_log.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'mentor_comment_error',
        detail: expect.objectContaining({ error: '403 Forbidden' }),
      }),
    );
    expect(result).toEqual({ error: '403 Forbidden' });
  });
});
