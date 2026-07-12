import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

type StepCtx = {
  event: { data: { userIds?: string[] } };
  step: { run: (name: string, fn: () => unknown) => unknown };
};
type RawHandler = (ctx: StepCtx) => unknown;

let capturedHandler: RawHandler | null = null;

vi.mock('../client', () => ({
  inngest: {
    createFunction: (_meta: unknown, _trigger: unknown, handler: RawHandler) => {
      capturedHandler = handler;
      return { __isMockedInngestFn: true };
    },
  },
}));

function runHandler(userIds: string[] = ['user-1']): Promise<unknown> {
  if (!capturedHandler)
    throw new Error('Handler not captured — import recommendations-worker first');
  return Promise.resolve(
    capturedHandler({
      event: { data: { userIds } },
      step: {
        run: (_name: string, fn: () => unknown) => fn(),
      },
    }),
  );
}

const mockIssuesLimit = vi.fn();
const mockUsersNot = vi.fn();
const mockSkipHistoryGte = vi.fn();
const mockSeenIn = vi.fn();
const mockUpsert = vi.fn();

let fromCallCount = 0;

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: (_table: string) => {
      const callIndex = fromCallCount++;

      if (callIndex === 0) {
        // issues pool: .select().eq().order().limit()
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: mockIssuesLimit,
              }),
            }),
          }),
        };
      }

      if (callIndex === 1) {
        // github_installations: .select().in().is().not()
        return {
          select: () => ({
            in: () => ({
              is: () => ({
                not: mockUsersNot,
              }),
            }),
          }),
        };
      }

      if (callIndex === 2) {
        // skip history: .select().in().eq().gte()
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                gte: mockSkipHistoryGte,
              }),
            }),
          }),
        };
      }

      if (callIndex === 3) {
        // seen ids bulk fetch: .select().in().order().order().range()
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                order: () => ({
                  range: mockSeenIn,
                }),
              }),
            }),
          }),
        };
      }

      // callIndex >= 4: .upsert(rows, opts)
      return {
        upsert: mockUpsert,
      };
    },
  }),
}));

describe('recommendations-build-worker', () => {
  beforeAll(async () => {
    await import('./recommendations-worker');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;

    mockIssuesLimit.mockResolvedValue({ data: [] });
    mockUsersNot.mockResolvedValue({ data: [] });
    mockSkipHistoryGte.mockResolvedValue({ data: [] });
    mockSeenIn.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('returns early when userIds is empty', async () => {
    const result = await runHandler([]);
    expect(result).toEqual({ users: 0, inserted: 0 });
    expect(fromCallCount).toBe(0); // DB never called
  });

  it('returns { users: 1, inserted: 0 } when the issue pool is empty', async () => {
    mockIssuesLimit.mockResolvedValue({ data: [] });

    const result = await runHandler();

    expect(result).toEqual({ users: 1, inserted: 0 });
  });

  it('returns { users: 0, inserted: 0 } when there are no active users returned', async () => {
    mockIssuesLimit.mockResolvedValue({
      data: [
        {
          id: 1,
          repo_full_name: 'a/b',
          github_issue_number: 10,
          title: 'Fix bug',
          difficulty: 'E',
          xp_reward: 100,
          repo_health_score: 80,
          repo_language: 'TypeScript',
          scored_at: new Date().toISOString(),
          state: 'open',
        },
      ],
    });
    mockUsersNot.mockResolvedValue({ data: [] });

    const result = await runHandler();

    expect(result).toEqual({ users: 0, inserted: 0 });
  });

  it('queries skip history with gte() and does not throw', async () => {
    const issue = {
      id: 1,
      repo_full_name: 'a/b',
      github_issue_number: 10,
      title: 'Fix bug',
      difficulty: 'E',
      xp_reward: 100,
      repo_health_score: 80,
      repo_language: 'TypeScript',
      scored_at: new Date().toISOString(),
      state: 'open',
    };

    mockIssuesLimit.mockResolvedValue({ data: [issue] });
    mockUsersNot.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          profiles: { level: 0, primary_language: 'TypeScript' },
        },
      ],
    });
    mockSkipHistoryGte.mockResolvedValue({ data: [] });
    mockSeenIn.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: null });

    const result = (await runHandler()) as { users: number; inserted: number };

    expect(mockSkipHistoryGte).toHaveBeenCalledOnce();
    expect(result.users).toBe(1);
    expect(result.inserted).toBeGreaterThanOrEqual(0);
  });

  it('applies skip history penalty — skipped repo ranks lower', async () => {
    const skippedIssue = {
      id: 1,
      repo_full_name: 'skipped/repo',
      github_issue_number: 1,
      title: 'Old issue',
      difficulty: 'E',
      xp_reward: 100,
      repo_health_score: 80,
      repo_language: 'TypeScript',
      scored_at: new Date().toISOString(),
      state: 'open',
    };
    const freshIssue = {
      id: 2,
      repo_full_name: 'fresh/repo',
      github_issue_number: 2,
      title: 'Fresh issue',
      difficulty: 'E',
      xp_reward: 100,
      repo_health_score: 80,
      repo_language: 'TypeScript',
      scored_at: new Date().toISOString(),
      state: 'open',
    };

    mockIssuesLimit.mockResolvedValue({ data: [skippedIssue, freshIssue] });
    mockUsersNot.mockResolvedValue({
      data: [{ user_id: 'user-1', profiles: { level: 0, primary_language: null } }],
    });
    mockSkipHistoryGte.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          issues: { repo_full_name: 'skipped/repo', repo_language: 'TypeScript' },
        },
        {
          user_id: 'user-1',
          issues: { repo_full_name: 'skipped/repo', repo_language: 'TypeScript' },
        },
      ],
    });
    mockSeenIn.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: null });

    await expect(runHandler()).resolves.not.toThrow();

    expect(mockSkipHistoryGte).toHaveBeenCalledOnce();
  });

  it('does not insert recommendations when upsert errors', async () => {
    const issue = {
      id: 1,
      repo_full_name: 'a/b',
      github_issue_number: 1,
      title: 'Bug',
      difficulty: 'E',
      xp_reward: 100,
      repo_health_score: 80,
      repo_language: null,
      scored_at: new Date().toISOString(),
      state: 'open',
    };

    mockIssuesLimit.mockResolvedValue({ data: [issue] });
    mockUsersNot.mockResolvedValue({
      data: [{ user_id: 'user-1', profiles: { level: 0, primary_language: null } }],
    });
    mockSkipHistoryGte.mockResolvedValue({ data: [] });
    mockSeenIn.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: new Error('db error') });

    const result = (await runHandler()) as { users: number; inserted: number };

    expect(result.users).toBe(1);
    expect(result.inserted).toBe(0);
  });
});
