import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoUnclaimStale, flagSuspiciousXpAccounts, streakDetect } from './maintenance';
import { sb, wire, step } from './__tests__/test-helpers';
import { detectSuspiciousPatterns } from '@/lib/xp/suspicious-patterns';
import { insertXpEvent } from '@/lib/xp/events';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/xp/suspicious-patterns', () => ({
  detectSuspiciousPatterns: vi.fn(),
}));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));
vi.mock('@/lib/xp/events', () => ({
  insertXpEvent: vi.fn(),
}));

const run = autoUnclaimStale as unknown as (ctx: {
  step: typeof step;
}) => Promise<{ unclaimed: number; warned: number }>;
const runFlagSuspiciousXpAccounts = flagSuspiciousXpAccounts as unknown as (ctx: {
  step: typeof step;
}) => Promise<{ scanned: true; inserted: number; candidates: number }>;
const runStreakDetect = streakDetect as unknown as (ctx: {
  step: typeof step;
}) => Promise<{ awarded: number; scanned: number }>;

describe('autoUnclaimStale', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unclaims stale recommendations and logs activity, warns day-10 users', async () => {
    const updateMock = vi.fn().mockResolvedValue({
      data: [{ id: 1, user_id: 'u1' }],
      error: null,
    });
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ id: 2, user_id: 'u2' }],
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const recsTableMock = sb({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            lt: vi.fn(() => ({
              select: updateMock,
            })),
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            gte: vi.fn(() => ({
              lt: selectMock,
            })),
          })),
        })),
      })),
    });

    const activityLogTableMock = sb({
      insert: insertMock,
    });

    wire({
      recommendations: recsTableMock,
      activity_log: activityLogTableMock,
    });

    const result = await run({ step });

    expect(result).toEqual({ unclaimed: 1, warned: 1 });
    expect(updateMock).toHaveBeenCalled();
    expect(selectMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(2);
  });
});

describe('flagSuspiciousXpAccounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('paginates audit reads, open-flag dedupe reads, and PR enrichment reads', async () => {
    const candidates = Array.from({ length: 501 }, (_, index) => ({
      userId: `user-${index}`,
      reason: 'daily_xp_event_spike' as const,
      severity: 'medium' as const,
      evidence: {
        summary: 'summary',
        windowStart: '2026-05-28T00:00:00.000Z',
        windowEnd: '2026-05-29T00:00:00.000Z',
        count: 6,
        items: [],
      },
    }));
    vi.mocked(detectSuspiciousPatterns).mockReturnValue(candidates);

    const xpEvents = makePagedTable([
      Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        user_id: 'user-0',
        source: 'merge',
        ref_id: `pr:${index}`,
        repo: 'org/repo',
        xp_delta: 10,
        created_at: '2026-05-28T12:00:00.000Z',
      })),
      [
        {
          id: 1001,
          user_id: 'user-0',
          source: 'merge',
          ref_id: 'pr:1001',
          repo: 'org/repo',
          xp_delta: 10,
          created_at: '2026-05-28T12:30:00.000Z',
        },
      ],
    ]);

    const mergedPullRequests = makePagedTable([[]]);
    const reviewPullRequests = makePagedTable([
      Array.from({ length: 1000 }, (_, index) => pullRequestRow(index + 1)),
      [pullRequestRow(1001)],
    ]);
    let pullRequestReadCount = 0;

    const pullRequestReviews = makePagedTable([
      Array.from({ length: 1000 }, (_, index) => reviewRow(index + 1)),
      [reviewRow(1001)],
    ]);

    const flaggedAccounts = makePagedTable([
      Array.from({ length: 1000 }, (_, index) => ({
        user_id: `existing-${index}`,
        reason: 'rapid_merge_spike',
      })),
      [{ user_id: 'existing-1001', reason: 'rapid_merge_spike' }],
      [],
    ]);
    const insertSelect = vi.fn().mockResolvedValue({
      data: candidates.map((_, index) => ({ id: index + 1 })),
      error: null,
    });
    flaggedAccounts.insert.mockReturnValue({ select: insertSelect });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'xp_events') return xpEvents;
        if (table === 'pull_requests') {
          pullRequestReadCount += 1;
          return pullRequestReadCount === 1 ? mergedPullRequests : reviewPullRequests;
        }
        if (table === 'pull_request_reviews') return pullRequestReviews;
        if (table === 'flagged_accounts') return flaggedAccounts;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const { getServiceSupabase } = await import('@/lib/supabase/service');
    vi.mocked(getServiceSupabase).mockReturnValue(client as never);

    await expect(runFlagSuspiciousXpAccounts({ step })).resolves.toEqual({
      scanned: true,
      inserted: 501,
      candidates: 501,
    });

    expect(xpEvents.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(xpEvents.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(pullRequestReviews.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(pullRequestReviews.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(reviewPullRequests.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(reviewPullRequests.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(flaggedAccounts.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(flaggedAccounts.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(flaggedAccounts.range).toHaveBeenNthCalledWith(3, 0, 999);
  });
});

function makePagedTable<T>(pages: T[][]) {
  const table = sb();
  table.gte = vi.fn(() => table);
  table.lt = vi.fn(() => table);
  table.range = vi.fn().mockImplementation(async () => ({
    data: pages.shift() ?? [],
    error: null,
  }));
  return table as ReturnType<typeof sb> & {
    gte: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
  };
}

function pullRequestRow(id: number) {
  return {
    id,
    repo_full_name: 'org/repo',
    number: id,
    title: `PR ${id}`,
    author_login: 'contributor',
    author_user_id: `user-${id}`,
    merged_at: '2026-05-28T12:00:00.000Z',
  };
}

function reviewRow(id: number) {
  return {
    id,
    pr_id: id,
    reviewer_login: 'mentor',
    reviewer_user_id: 'mentor-1',
    state: 'approved',
    submitted_at: '2026-05-28T12:00:00.000Z',
  };
}

describe('streakDetect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('awards streak XP to users under the cap, but skips users over the cap', async () => {
    const { getServiceSupabase } = await import('@/lib/supabase/service');
    vi.mocked(insertXpEvent).mockResolvedValue(true);

    const xpEventsMock = {
      select: vi.fn().mockImplementation((selectString) => {
        if (selectString === 'user_id') {
          return {
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ user_id: 'user-under-cap' }, { user_id: 'user-over-cap' }],
              error: null,
            }),
          };
        }
        if (selectString === 'user_id, created_at') {
          const eventsUnder = Array.from({ length: 5 }, (_, i) => {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - 1 - i);
            return { user_id: 'user-under-cap', created_at: d.toISOString() };
          });
          const eventsOver = Array.from({ length: 11 }, (_, i) => {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - 1 - i);
            return { user_id: 'user-over-cap', created_at: d.toISOString() };
          });
          const allEvents = [...eventsUnder, ...eventsOver];

          const ltObj = {
            range: vi.fn().mockResolvedValue({
              data: allEvents,
              error: null,
            }),
          };
          const gteObj = {
            lt: vi.fn().mockReturnValue(ltObj),
          };
          const inObj = {
            gte: vi.fn().mockReturnValue(gteObj),
          };
          return {
            in: vi.fn().mockReturnValue(inObj),
          };
        }
      }),
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'xp_events') return xpEventsMock;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    vi.mocked(getServiceSupabase).mockReturnValue(client as never);

    const result = await runStreakDetect({ step });

    expect(result.scanned).toBe(2);
    expect(result.awarded).toBe(1);

    // Should only have called insertXpEvent for the user under the cap.
    expect(insertXpEvent).toHaveBeenCalledTimes(1);
    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-under-cap',
        source: 'streak',
      }),
    );
  });
});
