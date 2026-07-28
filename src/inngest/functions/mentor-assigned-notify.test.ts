import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMentorAssignedEmail } from '@/lib/email';
import { mentorAssignedNotify } from './mentor-assigned-notify';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendMentorAssignedEmail: vi.fn() }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = mentorAssignedNotify as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

const ev = (over: Record<string, unknown> = {}) => ({
  data: {
    mentorUserId: 'mentor-1',
    authorLogin: 'contributor',
    prUrl: 'https://github.com/org/repo/pull/42',
    prTitle: 'fix: resolve login bug',
    repo: 'org/repo',
    prNumber: 42,
    ...over,
  },
});

describe('mentorAssignedNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs activity and sends email to mentor', async () => {
    const activityLog = sb({ insert: vi.fn().mockResolvedValue({}) });
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { github_handle: 'senior-dev' },
        }),
      }),
      profile_emails: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { email: 'senior@example.com' },
        }),
      }),
      activity_log: activityLog,
    });

    const result = await run({ event: ev(), step });

    expect(activityLog.insert).toHaveBeenCalledWith({
      user_id: 'mentor-1',
      kind: 'mentor_auto_assigned',
      detail: {
        prUrl: 'https://github.com/org/repo/pull/42',
        prTitle: 'fix: resolve login bug',
        repo: 'org/repo',
        prNumber: 42,
        authorLogin: 'contributor',
      },
    });

    expect(sendMentorAssignedEmail).toHaveBeenCalledWith({
      to: 'senior@example.com',
      mentorHandle: 'senior-dev',
      authorHandle: 'contributor',
      prUrl: 'https://github.com/org/repo/pull/42',
      prTitle: 'fix: resolve login bug',
      repo: 'org/repo',
    });

    expect(result).toEqual(expect.objectContaining({ emailed: true, to: 'senior@example.com' }));
  });

  it('skips email if mentor has no email on file', async () => {
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { github_handle: 'senior-dev' },
        }),
      }),
      profile_emails: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
      activity_log: sb({ insert: vi.fn().mockResolvedValue({}) }),
    });

    const result = await run({ event: ev(), step });

    expect(sendMentorAssignedEmail).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ skipped: true, reason: 'no_email' }));
  });

  it('skips email if mentor profile is not found', async () => {
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
      activity_log: sb({ insert: vi.fn().mockResolvedValue({}) }),
    });

    const result = await run({ event: ev(), step });

    expect(sendMentorAssignedEmail).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ skipped: true, reason: 'mentor_not_found' }));
  });

  it('returns emailed: false if sendMentorAssignedEmail throws', async () => {
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { github_handle: 'senior-dev' },
        }),
      }),
      profile_emails: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { email: 'senior@example.com' },
        }),
      }),
      activity_log: sb({ insert: vi.fn().mockResolvedValue({}) }),
    });

    vi.mocked(sendMentorAssignedEmail).mockRejectedValue(new Error('Resend down'));

    const result = await run({ event: ev(), step });

    expect(result).toEqual(expect.objectContaining({ emailed: false, error: 'Resend down' }));
  });
});
