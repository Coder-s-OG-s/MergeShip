import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractIssueNumbers, processPrEvent } from './process-pr-event';
import { insertXpEvent } from '@/lib/xp/events';
import { cacheDelByPrefix } from '@/lib/cache';
import { sb, wire, step } from './__tests__/test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/xp/events', () => ({ insertXpEvent: vi.fn() }));
vi.mock('@/lib/cache', () => ({ cacheDelByPrefix: vi.fn() }));
vi.mock('@/lib/daily-challenge/progress', () => ({
  incrementChallengeProgress: vi.fn().mockResolvedValue({ ok: true }),
}));
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

  it('ignores bare "#7" references', () => {
    expect(extractIssueNumbers('related to #7')).toEqual([]);
  });

  it('dedupes repeated numbers', () => {
    expect(extractIssueNumbers('closes #5 fixes #5')).toEqual([5]);
  });

  it('ignores non-issue # like #foo', () => {
    expect(extractIssueNumbers('section #foo and #1')).toEqual([]);
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
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { repo_full_name: 'owner/repo', installation_id: 1 } }),
    });
    const profilesMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'contributor-id' } }),
    });
    const pullRequestsMock = sb({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const installationSettingsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { ai_pr_detection: false } }),
    });

    wire({
      recommendations: recommendationsMock,
      xp_events: xpEventsMock,
      activity_log: activityLogMock,
      installation_repositories: installationRepositoriesMock,
      profiles: profilesMock,
      pull_requests: pullRequestsMock,
      installation_settings: installationSettingsMock,
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
    expect(cacheDelByPrefix).toHaveBeenCalledWith('profile:v3:');
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

describe('processPrEvent - linkPrToClaim issues relation array', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (issuesArray: unknown) => {
    const recommendationsMock = sb({
      is: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            issue_id: 101,
            issues: issuesArray,
          },
        ],
      }),
      update: vi.fn().mockReturnThis(),
    });

    const profilesMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'contributor-id' } }),
    });

    const pullRequestsMock = sb({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const installationRepositoriesMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { repo_full_name: 'owner/repo', installation_id: 1 } }),
    });
    const installationSettingsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { ai_pr_detection: false } }),
    });

    wire({
      recommendations: recommendationsMock,
      profiles: profilesMock,
      pull_requests: pullRequestsMock,
      installation_repositories: installationRepositoriesMock,
      installation_settings: installationSettingsMock,
    });

    return { recommendationsMock };
  };

  const evOpened = () => ({
    data: {
      payload: {
        action: 'opened',
        pull_request: {
          id: 1234,
          number: 1,
          html_url: 'https://github.com/owner/repo/pull/1',
          title: 'Fix issue',
          body: 'Closes #123',
          state: 'open',
          draft: false,
          merged: false,
          merged_at: null,
          closed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          user: { login: 'contributor' },
          base: { repo: { full_name: 'owner/repo' } },
        },
      },
    },
  });

  it('handles issues relation returned as an array', async () => {
    const { recommendationsMock } = setupMock([
      { repo_full_name: 'owner/repo', github_issue_number: 123 },
    ]);

    await prRun({ event: evOpened(), step });

    expect(recommendationsMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ linked_pr_url: 'https://github.com/owner/repo/pull/1' }),
    );
  });

  it('handles issues relation returned as a single object', async () => {
    const { recommendationsMock } = setupMock({
      repo_full_name: 'owner/repo',
      github_issue_number: 123,
    });

    await prRun({ event: evOpened(), step });

    expect(recommendationsMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ linked_pr_url: 'https://github.com/owner/repo/pull/1' }),
    );
  });
});
describe('processPrEvent - auto-assign mentor chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openedEvent = () => ({
    data: {
      payload: {
        action: 'opened',
        pull_request: {
          id: 1234,
          number: 7,
          html_url: 'https://github.com/owner/repo/pull/7',
          title: 'Fix issue',
          body: 'No issue ref',
          state: 'open',
          draft: false,
          merged: false,
          merged_at: null,
          closed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          user: { login: 'junior' },
          base: { repo: { full_name: 'owner/repo' } },
        },
      },
    },
  });

  it('assigns an org admin when the author is below the configured queue gate', async () => {
    const installationRepositoriesMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { repo_full_name: 'owner/repo', installation_id: 1 } })
        .mockResolvedValueOnce({ data: { installation_id: 1 } }),
    });
    const profilesMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: 'author-id' } })
        .mockResolvedValueOnce({ data: { level: 1 } })
        .mockResolvedValueOnce({ data: null }),
    });
    const pullRequestsMock = sb({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 10,
          author_user_id: 'author-id',
          mentor_reviewer_id: null,
        },
      }),
    });
    // Mock the active assignments query which terminates on .eq('mentor_verified', false)
    const originalEq = pullRequestsMock.eq as Function;
    pullRequestsMock.eq = vi.fn((col, val) => {
      if (col === 'mentor_verified' && val === false) {
        return Promise.resolve({ data: [] });
      }
      return originalEq(col, val);
    });
    const installationSettingsMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { ai_pr_detection: false } }) // upsertPrRow check
        .mockResolvedValueOnce({
          data: { min_contributor_level: 2, auto_assign_mentor_chain: true },
        }), // mentor assign check
    });
    const seniorRowsMock = sb();
    seniorRowsMock.eq = vi.fn().mockReturnValue(seniorRowsMock);
    seniorRowsMock.gte = vi.fn().mockResolvedValue({
      data: [{ user_id: 'senior-id', profiles: { github_handle: 'senior', level: 3 } }],
    });

    wire({
      installation_repositories: installationRepositoriesMock,
      installation_settings: installationSettingsMock,
      profiles: profilesMock,
      pull_requests: pullRequestsMock,
      github_installation_users: seniorRowsMock,
      recommendations: sb({ is: vi.fn().mockResolvedValue({ data: [] }) }),
    });

    await prRun({ event: openedEvent(), step });

    expect(pullRequestsMock.update).toHaveBeenCalledWith({ mentor_reviewer_id: 'senior-id' });
  });
});

describe('processPrEvent - ai_flagged classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeOpenedEvent = (title: string, body: string) => ({
    data: {
      payload: {
        action: 'opened',
        pull_request: {
          id: 5000,
          number: 50,
          html_url: 'https://github.com/owner/repo/pull/50',
          title,
          body,
          state: 'open',
          draft: false,
          merged: false,
          merged_at: null,
          closed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          user: { login: 'contributor' },
          base: { repo: { full_name: 'owner/repo' } },
        },
      },
    },
  });

  const setupClassifyMock = (aiPrDetection: boolean) => {
    const pullRequestsMock = sb({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const installationRepositoriesMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { repo_full_name: 'owner/repo', installation_id: 1 },
      }),
    });
    const installationSettingsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { ai_pr_detection: aiPrDetection } }),
    });
    const profilesMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'contrib-id' } }),
    });

    wire({
      installation_repositories: installationRepositoriesMock,
      installation_settings: installationSettingsMock,
      profiles: profilesMock,
      pull_requests: pullRequestsMock,
      recommendations: sb({ is: vi.fn().mockResolvedValue({ data: [] }) }),
    });

    return { pullRequestsMock };
  };

  it('sets ai_flagged=true when detection is on and PR looks like AI spam', async () => {
    const { pullRequestsMock } = setupClassifyMock(true);

    await prRun({
      event: makeOpenedEvent('fix', 'generated by chatgpt'),
      step,
    });

    expect(pullRequestsMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ai_flagged: true, ai_flag_reason: 'generated_msg' }),
      expect.anything(),
    );
  });

  it('sets ai_flagged=false when detection is on but PR looks normal', async () => {
    const { pullRequestsMock } = setupClassifyMock(true);

    await prRun({
      event: makeOpenedEvent(
        'Refactor payment gateway to use retry logic',
        'This PR adds exponential backoff to all payment API calls. Closes #100.',
      ),
      step,
    });

    expect(pullRequestsMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ai_flagged: false, ai_flag_reason: null }),
      expect.anything(),
    );
  });

  it('sets ai_flagged=false when aiPrDetection is disabled even for suspicious PR', async () => {
    const { pullRequestsMock } = setupClassifyMock(false);

    await prRun({
      event: makeOpenedEvent('fix', 'generated by chatgpt'),
      step,
    });

    expect(pullRequestsMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ai_flagged: false, ai_flag_reason: null }),
      expect.anything(),
    );
  });
});
