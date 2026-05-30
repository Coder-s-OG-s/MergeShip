import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractIssueNumbers, processPrEvent } from './process-pr-event';
import { insertXpEvent } from '@/lib/xp/events';
import { sb, wire, step } from './test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/xp/events', () => ({ insertXpEvent: vi.fn() }));
vi.mock('@/lib/cache', () => ({ cacheDelByPrefix: vi.fn() }));
const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

// Handler reference.
const prRun = processPrEvent as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

// Factory for a pull_request closed & merged event.
const ev = (prUrl: string, repo: string, number: number) => ({
  data: {
    payload: {
      action: 'closed',
      pull_request: {
        id: 1234,
        number,
        html_url: prUrl,
        title: 'Fix issue',
        body: 'Closes #12',
        state: 'closed',
        draft: false,
        merged: true,
        merged_at: '2026-01-01T00:00:00Z',
        closed_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        user: { login: 'contributor' },
        base: { repo: { full_name: repo } },
      },
    },
  },
});

describe('extractIssueNumbers', () => {
  it('finds "closes #123"', () => {
    expect(extractIssueNumbers('closes #123')).toEqual([123]);
  });

  it('finds "fixes #45" and "resolves #67"', () => {
    expect(extractIssueNumbers('fixes #45 and resolves #67')).toEqual([45, 67]);
  });

  it('finds bare "#7" references', () => {
    expect(extractIssueNumbers('related to #7')).toEqual([7]);
  });

  it('dedupes repeated numbers', () => {
    expect(extractIssueNumbers('#5 #5 closes #5')).toEqual([5]);
  });

  it('ignores non-issue # like #foo', () => {
    expect(extractIssueNumbers('section #foo and #1')).toEqual([1]);
  });

  it('returns empty on null/empty', () => {
    expect(extractIssueNumbers(null)).toEqual([]);
    expect(extractIssueNumbers('')).toEqual([]);
    expect(extractIssueNumbers(undefined)).toEqual([]);
  });

  it('case-insensitive', () => {
    expect(extractIssueNumbers('CLOSES #99')).toEqual([99]);
    expect(extractIssueNumbers('Fixed #100')).toEqual([100]);
  });
});

describe('processPrEvent - awardRecommendedMerge XP capping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (rec: {
    id: number;
    user_id: string;
    difficulty: string;
    xp_reward: number | null;
    status: string;
  }) => {
    const recommendationsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: rec }),
      update: vi.fn().mockReturnThis(),
    });
    const xpEventsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }), // no existing xp event
    });
    const activityLogMock = sb({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    const installationRepositoriesMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { repo_full_name: 'owner/repo' } }),
    });
    const profilesMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'contributor-id' } }),
    });
    const pullRequestsMock = sb({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    wire({
      recommendations: recommendationsMock,
      xp_events: xpEventsMock,
      activity_log: activityLogMock,
      installation_repositories: installationRepositoriesMock,
      profiles: profilesMock,
      pull_requests: pullRequestsMock,
    });

    vi.mocked(insertXpEvent).mockResolvedValue(true as never);

    return { recommendationsMock, activityLogMock };
  };

  it('clamps inflated rec.xp_reward to difficulty ceiling (Easy)', async () => {
    const { activityLogMock } = setupMock({
      id: 1,
      user_id: 'user-1',
      difficulty: 'E',
      xp_reward: 9999,
      status: 'claimed',
    });

    await prRun({ event: ev('https://github.com/owner/repo/pull/1', 'owner/repo', 1), step });

    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        xpDelta: 50, // Capped to Easy ceiling (50)
      }),
    );

    expect(activityLogMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        kind: 'pr_merged',
        detail: expect.objectContaining({
          xpAwarded: 50, // Clamped logged value
        }),
      }),
    );
  });

  it('clamps inflated rec.xp_reward to difficulty ceiling (Medium)', async () => {
    const { activityLogMock } = setupMock({
      id: 2,
      user_id: 'user-2',
      difficulty: 'M',
      xp_reward: 350,
      status: 'claimed',
    });

    await prRun({ event: ev('https://github.com/owner/repo/pull/2', 'owner/repo', 2), step });

    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        xpDelta: 150, // Capped to Medium ceiling (150)
      }),
    );

    expect(activityLogMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-2',
        kind: 'pr_merged',
        detail: expect.objectContaining({
          xpAwarded: 150, // Clamped logged value
        }),
      }),
    );
  });

  it('clamps inflated rec.xp_reward to difficulty ceiling (Hard)', async () => {
    const { activityLogMock } = setupMock({
      id: 3,
      user_id: 'user-3',
      difficulty: 'H',
      xp_reward: 1000,
      status: 'claimed',
    });

    await prRun({ event: ev('https://github.com/owner/repo/pull/3', 'owner/repo', 3), step });

    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-3',
        xpDelta: 400, // Capped to Hard ceiling (400)
      }),
    );

    expect(activityLogMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-3',
        kind: 'pr_merged',
        detail: expect.objectContaining({
          xpAwarded: 400, // Clamped logged value
        }),
      }),
    );
  });

  it('uses raw rec.xp_reward if it is within difficulty ceiling', async () => {
    const { activityLogMock } = setupMock({
      id: 4,
      user_id: 'user-4',
      difficulty: 'E',
      xp_reward: 30,
      status: 'claimed',
    });

    await prRun({ event: ev('https://github.com/owner/repo/pull/4', 'owner/repo', 4), step });

    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-4',
        xpDelta: 30, // Within cap, so used as-is
      }),
    );

    expect(activityLogMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-4',
        kind: 'pr_merged',
        detail: expect.objectContaining({
          xpAwarded: 30,
        }),
      }),
    );
  });

  it('falls back to default difficulty xp reward when xp_reward is null', async () => {
    const { activityLogMock } = setupMock({
      id: 5,
      user_id: 'user-5',
      difficulty: 'E',
      xp_reward: null,
      status: 'claimed',
    });

    await prRun({ event: ev('https://github.com/owner/repo/pull/5', 'owner/repo', 5), step });

    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-5',
        xpDelta: 50, // Falls back to Easy ceiling (50)
      }),
    );

    expect(activityLogMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-5',
        kind: 'pr_merged',
        detail: expect.objectContaining({
          xpAwarded: 50,
        }),
      }),
    );
  });
});
