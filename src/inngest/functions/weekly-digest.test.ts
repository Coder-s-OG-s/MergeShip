import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { weeklyDigest, sendUserDigest, getWeekKey } from './weekly-digest';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendWeeklyDigestEmail: vi.fn() }));
vi.mock('@/lib/xp/curve', () => ({ xpToNextLevel: vi.fn(() => ({ needed: 500 })) }));

const mockSend = vi.fn().mockResolvedValue(undefined);

vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: any[]) => mockSend(...args),
  },
}));

const runDispatcher = weeklyDigest as unknown as (ctx: { step: typeof step }) => Promise<{
  dispatched: number;
}>;

const runChild = sendUserDigest as unknown as (ctx: {
  event: { data: any };
  step: typeof step;
}) => Promise<any>;

/** Build a minimal profile row that matches the Supabase select shape. */
const makeUser = (id: string, email: string | null, overrides: Record<string, unknown> = {}) => ({
  id,
  github_handle: `user-${id}`,
  xp: 100,
  level: 2,
  profile_emails: email ? [{ email }] : [],
  ...overrides,
});

describe('getWeekKey', () => {
  it('returns the Monday of the given week in YYYY-MM-DD format', () => {
    // Wednesday 2026-07-09
    expect(getWeekKey(new Date('2026-07-09T12:00:00Z'))).toBe('2026-07-06');
  });

  it('returns the Monday when input is a Sunday', () => {
    // Sunday 2026-07-05
    expect(getWeekKey(new Date('2026-07-05T12:00:00Z'))).toBe('2026-06-29');
  });

  it('returns the same day when input is already a Monday', () => {
    // Monday 2026-07-06
    expect(getWeekKey(new Date('2026-07-06T12:00:00Z'))).toBe('2026-07-06');
  });
});

describe('weeklyDigest dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when there are no eligible users', async () => {
    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await runDispatcher({ step });
    expect(result).toEqual({ dispatched: 0 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('dispatches events with stable dedup IDs for eligible users', async () => {
    const users = [makeUser('u1', 'u1@example.com'), makeUser('u2', 'u2@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
    });

    const result = await runDispatcher({ step });

    expect(result).toEqual({ dispatched: 2 });
    expect(mockSend).toHaveBeenCalledTimes(1);

    const sentEvents = mockSend.mock.calls[0]![0];
    expect(sentEvents).toHaveLength(2);
    expect(sentEvents[0].name).toBe('weekly-digest/send-to-user');
    expect(sentEvents[0].id).toMatch(/^weekly-digest-u1-\d{4}-\d{2}-\d{2}$/);
    expect(sentEvents[1].id).toMatch(/^weekly-digest-u2-\d{4}-\d{2}-\d{2}$/);
  });

  it('skips users with no email and dispatches events only for users with emails', async () => {
    const users = [makeUser('u1', null), makeUser('u2', 'u2@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
    });

    const result = await runDispatcher({ step });

    expect(result).toEqual({ dispatched: 1 });
    expect(mockSend).toHaveBeenCalledTimes(1);

    const sentEvents = mockSend.mock.calls[0]![0];
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0].data.userId).toBe('u2');
  });

  it('uses step.run to fetch users and dispatch events', async () => {
    const users = [makeUser('abc', 'abc@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
    });

    const stepRunSpy = vi.spyOn(step, 'run');

    await runDispatcher({ step });

    const stepNames = stepRunSpy.mock.calls.map(([name]) => name);
    expect(stepNames).toContain('fetch-eligible-users');
    expect(stepNames).toContain('dispatch-user-digests');
  });
});

describe('sendUserDigest child handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a weekly digest email for the given user', async () => {
    wire({
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [
            { xp_delta: 50, source: 'recommended_merge' },
            { xp_delta: 30, source: 'review' },
            { xp_delta: 20, source: 'issue_authored_closed' },
          ],
          error: null,
        }),
      }),
      recommendations: sb({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    vi.mocked(sendWeeklyDigestEmail).mockResolvedValue({ skipped: true } as any);

    const result = await runChild({
      event: {
        data: {
          userId: 'u1',
          email: 'u1@example.com',
          githubHandle: 'user-u1',
          xp: 100,
          level: 2,
        },
      },
      step,
    });

    expect(result).toEqual({ success: true });
    expect(sendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u1@example.com',
        xpGained: 100,
        prsMerged: 1,
        reviewsPerformed: 1,
        issuesCompleted: 1,
      }),
    );
  });

  it('throws on xp_events DB error so Inngest retries', async () => {
    wire({
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection reset', code: '08006' },
        }),
      }),
    });

    await expect(
      runChild({
        event: {
          data: {
            userId: 'u1',
            email: 'u1@example.com',
            githubHandle: 'user-u1',
            xp: 100,
            level: 2,
          },
        },
        step,
      }),
    ).rejects.toThrow('Failed to fetch xp_events for u1');

    expect(sendWeeklyDigestEmail).not.toHaveBeenCalled();
  });
});
