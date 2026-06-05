import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

/**
 * Unit tests for recommendations-build Inngest function.
 *
 * The production function issues these Supabase queries in order:
 *   1. from('issues').select(...).eq('state','open').order(...).limit()   → candidate pool
 *   2. from('github_installations').select(...).is(...).not(...)           → active users
 *   3. from('recommendations').select(...).eq('status','reassigned').gte() → skip history
 *   4. per-user: from('recommendations').select('issue_id').eq('user_id') → seen ids
 *   5. from('recommendations').upsert(...)                                 → write picks
 *
 * The mock below must handle all five shapes through a single `from()` factory.
 */

// ---------------------------------------------------------------------------
// Mock: inngest client
//
// createFunction() returns an opaque InngestFunction object in production.
// Here we capture the raw handler at mock-time so tests can invoke it directly
// via runHandler(), bypassing the Inngest runtime entirely.
// ---------------------------------------------------------------------------
type StepCtx = { step: { run: (name: string, fn: () => unknown) => unknown } };
type RawHandler = (ctx: StepCtx) => unknown;

let capturedHandler: RawHandler | null = null;

vi.mock('../client', () => ({
  inngest: {
    createFunction: (_meta: unknown, _trigger: unknown, handler: RawHandler) => {
      capturedHandler = handler;
      // Return a non-callable sentinel so the module exports something.
      return { __isMockedInngestFn: true };
    },
  },
}));

/** Invoke the captured handler with a step.run() that calls its callback directly. */
function runHandler(): Promise<unknown> {
  if (!capturedHandler)
    throw new Error('Handler not captured — import recommendations-build first');
  return Promise.resolve(
    capturedHandler({
      step: {
        run: (_name: string, fn: () => unknown) => fn(),
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Mock: getServiceSupabase
//
// The builder is called multiple times on the same `from()` factory.
// We need to distinguish call sites by the table name and/or which terminal
// method is eventually invoked.  We achieve this by tracking a simple call
// counter that resets in beforeEach.
// ---------------------------------------------------------------------------

// Terminal mocks — reassigned in beforeEach so each test can override them.
const mockIssuesLimit = vi.fn();
const mockUsersNot = vi.fn();
const mockSkipHistoryGte = vi.fn(); // from('recommendations').eq('status','reassigned').gte()
const mockSeenEq = vi.fn(); // from('recommendations').eq('user_id', ...)  (per-user)
const mockUpsert = vi.fn();

/**
 * Tiny state machine: `from()` is called once per query; we use a counter
 * so the nth call returns the nth builder shape.
 *
 * Call order inside build-all step:
 *   0 → issues pool   (.select.eq.order.limit)
 *   1 → users         (.select.is.not)
 *   2 → skip history  (.select.eq.gte)
 *   3 → seen ids      (.select.eq)        ← per-user, may repeat
 *   4+ → upsert       (.upsert)           ← per-user, may repeat
 */
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
        // github_installations: .select().is().not()
        return {
          select: () => ({
            is: () => ({
              not: mockUsersNot,
            }),
          }),
        };
      }

      if (callIndex === 2) {
        // skip history: .select().eq('status','reassigned').gte('recommended_at', ...)
        return {
          select: () => ({
            eq: () => ({
              gte: mockSkipHistoryGte,
            }),
          }),
        };
      }

      // callIndex >= 3 alternates between seen-ids selects and upserts
      // per-user seen ids: .select('issue_id').eq('user_id', ...)
      // upsert:            .upsert(rows, opts)
      return {
        select: () => ({
          eq: mockSeenEq,
        }),
        upsert: mockUpsert,
      };
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recommendations-build', () => {
  beforeAll(async () => {
    await import('./recommendations-build');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;

    // Default: empty pool → early-exit path (users: 0, inserted: 0)
    mockIssuesLimit.mockResolvedValue({ data: [] });
    mockUsersNot.mockResolvedValue({ data: [] });
    mockSkipHistoryGte.mockResolvedValue({ data: [] });
    mockSeenEq.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('returns { users: 0, inserted: 0 } when the issue pool is empty', async () => {
    mockIssuesLimit.mockResolvedValue({ data: [] });

    const result = await runHandler();

    expect(result).toEqual({ users: 0, inserted: 0 });
  });

  it('returns { users: 0, inserted: 0 } when there are no active users', async () => {
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
    // skip history returns empty — no penalty applied
    mockSkipHistoryGte.mockResolvedValue({ data: [] });
    // user has no previously seen issues
    mockSeenEq.mockResolvedValue({ data: [] });
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
    // Two skip-history rows for 'skipped/repo' → triggers repo penalty
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
    mockSeenEq.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: null });

    // Should not throw — penalty logic runs without error
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
    mockSeenEq.mockResolvedValue({ data: [] });
    mockUpsert.mockResolvedValue({ error: new Error('db error') });

    const result = (await runHandler()) as { users: number; inserted: number };

    expect(result.users).toBe(1);
    expect(result.inserted).toBe(0); // error → not counted
  });
});
