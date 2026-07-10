import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { weeklyDigest } from './weekly-digest';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendWeeklyDigestEmail: vi.fn() }));
vi.mock('@/lib/xp/curve', () => ({ xpToNextLevel: vi.fn(() => ({ needed: 500 })) }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const emailSent = { skipped: true } as const;

const run = weeklyDigest as unknown as (ctx: { step: typeof step }) => Promise<{
  processed: number;
  skipped: number;
}>;

/** Build a minimal profile row that matches the Supabase select shape. */
const makeUser = (id: string, email: string | null, overrides: Record<string, unknown> = {}) => ({
  id,
  github_handle: `user-${id}`,
  xp: 100,
  level: 2,
  profile_emails: email ? [{ email }] : [],
  ...overrides,
});

describe('weeklyDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when there are no eligible users', async () => {
    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await run({ step });
    expect(result).toEqual({ processed: 0, skipped: 0 });
    expect(sendWeeklyDigestEmail).not.toHaveBeenCalled();
  });

  it('sends an email for each eligible user and returns correct counts', async () => {
    const users = [makeUser('u1', 'u1@example.com'), makeUser('u2', 'u2@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      recommendations: sb({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    vi.mocked(sendWeeklyDigestEmail).mockResolvedValue(emailSent);

    const result = await run({ step });

    expect(result).toEqual({ processed: 2, skipped: 0 });
    expect(sendWeeklyDigestEmail).toHaveBeenCalledTimes(2);
  });

  it('skips users with no email address without calling sendWeeklyDigestEmail', async () => {
    const users = [makeUser('u1', null), makeUser('u2', 'u2@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      recommendations: sb({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    vi.mocked(sendWeeklyDigestEmail).mockResolvedValue(emailSent);

    const result = await run({ step });

    // u1 has no email → skipped; u2 has email → processed
    expect(result).toEqual({ processed: 1, skipped: 1 });
    expect(sendWeeklyDigestEmail).toHaveBeenCalledTimes(1);
    expect(sendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u2@example.com' }),
    );
  });

  it('processes users in batches, using batch-named step keys', async () => {
    const users = [makeUser('abc', 'abc@example.com'), makeUser('xyz', 'xyz@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      recommendations: sb({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    vi.mocked(sendWeeklyDigestEmail).mockResolvedValue(emailSent);

    const stepRunSpy = vi.spyOn(step, 'run');

    await run({ step });

    const stepNames = stepRunSpy.mock.calls.map(([name]) => name);
    expect(stepNames).toContain('fetch-eligible-users');
    expect(stepNames).toContain('send-digest-batch-0');
  });

  it("one user's failure does not affect other users in the batch", async () => {
    const users = [makeUser('u1', 'u1@example.com'), makeUser('u2', 'u2@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      recommendations: sb({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    vi.mocked(sendWeeklyDigestEmail)
      .mockRejectedValueOnce(new Error('email provider timeout'))
      .mockResolvedValueOnce(emailSent);

    const result = await run({ step });

    // u1 failed (caught → skipped), u2 succeeded
    expect(result).toEqual({ processed: 1, skipped: 1 });
    expect(sendWeeklyDigestEmail).toHaveBeenCalledTimes(2);
    expect(sendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u2@example.com' }),
    );
  });

  it('handles xp_events DB error gracefully by skipping that user', async () => {
    const users = [makeUser('u1', 'u1@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'connection reset', code: '08006' } }),
      }),
      recommendations: sb({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    // Should not throw — the error is caught and the user is skipped.
    const result = await run({ step });
    expect(result).toEqual({ processed: 0, skipped: 1 });
    expect(sendWeeklyDigestEmail).not.toHaveBeenCalled();
  });

  it('correctly aggregates xp and activity counts from xp_events', async () => {
    const users = [makeUser('u1', 'u1@example.com')];

    wire({
      profiles: sb({
        eq: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
      xp_events: sb({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [
            { xp_delta: 50, source: 'recommended_merge' },
            { xp_delta: 30, source: 'review' },
            { xp_delta: 20, source: 'issue_authored_closed' },
            { xp_delta: 10, source: 'other' },
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

    vi.mocked(sendWeeklyDigestEmail).mockResolvedValue(emailSent);

    await run({ step });

    expect(sendWeeklyDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u1@example.com',
        xpGained: 110,
        prsMerged: 1,
        reviewsPerformed: 1,
        issuesCompleted: 1,
      }),
    );
  });
});
