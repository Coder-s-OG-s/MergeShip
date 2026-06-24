import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rankReviewers } from '@/lib/help/dispatch';
import { sendHelpDispatchEmail } from '@/lib/email';
import { helpDispatch } from './help-dispatch';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/help/dispatch', () => ({ rankReviewers: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendHelpDispatchEmail: vi.fn() }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = helpDispatch as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

const ev = (over: Record<string, unknown> = {}) => ({
  data: { helpRequestId: 123, userId: 'u1', prUrl: 'https://github.com/foo/bar/pull/1', ...over },
});

describe('helpDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches help request and logs activity', async () => {
    const activity_log = sb({ insert: vi.fn().mockResolvedValue({}) });
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({
          data: [
            { id: 'm1', level: 2, primary_language: 'TypeScript' },
            { id: 'm2', level: 3, primary_language: 'Python' },
          ],
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { level: 1, primary_language: 'TypeScript' },
        }),
      }),
      cohort_members: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { cohort_id: 'c1' } }),
      }),
      activity_log,
    });

    vi.mocked(rankReviewers).mockReturnValue([
      {
        userId: 'm1',
        level: 2,
        sameOrgReviewed: false,
        sameCohort: false,
        languageMatch: true,
      },
    ]);

    const result = await run({ event: ev(), step });

    expect(activity_log.insert).toHaveBeenCalledWith([
      {
        user_id: 'm1',
        kind: 'help_dispatch',
        detail: { helpRequestId: 123, fromUserId: 'u1' },
      },
    ]);
    expect(result).toEqual({ helpRequestId: 123, notified: 1 });
  });

  it('returns early if no candidates found', async () => {
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({ data: [] }), // Empty pool
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
      cohort_members: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
    });

    vi.mocked(rankReviewers).mockReturnValue([]);

    const result = await run({ event: ev(), step });
    expect(result).toEqual({ helpRequestId: 123, notified: 0 });
  });

  it('resolves mentor email from profile_emails and sends email', async () => {
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        neq: vi.fn().mockResolvedValue({
          data: [{ id: 'm1', level: 2, primary_language: 'TypeScript', github_handle: 'mentor1' }],
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { level: 1, primary_language: 'TypeScript', github_handle: 'mentee' },
        }),
      }),
      cohort_members: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
      profile_emails: sb({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ user_id: 'm1', email: 'test_mentor@example.com' }],
        }),
      }),
      help_requests: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { reason: 'stuck on tests', pr_url: 'https://github.com/foo/bar/pull/1' },
        }),
      }),
    });

    vi.mocked(rankReviewers).mockReturnValue([
      {
        userId: 'm1',
        level: 2,
        sameOrgReviewed: false,
        sameCohort: false,
        languageMatch: true,
      },
    ]);

    await run({ event: ev(), step });

    expect(sendHelpDispatchEmail).toHaveBeenCalledWith({
      to: 'test_mentor@example.com',
      mentorHandle: 'mentor1',
      menteeHandle: 'mentee',
      prUrl: 'https://github.com/foo/bar/pull/1',
      helpReason: 'stuck on tests',
    });
  });
});
