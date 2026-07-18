import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  htmlEscape,
  sendHelpDispatchEmail,
  sendMentorAssignedEmail,
  sendWeeklyDigestEmail,
  sendOrganizationInviteEmail,
} from './email';

// Mock the resend module
vi.mock('resend', () => {
  const sendMock = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: sendMock,
      },
    })),
  };
});

// To access the mock instance later
import { Resend } from 'resend';

describe('Email Provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, RESEND_API_KEY: 'test-key' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('htmlEscape', () => {
    it('escapes special characters', () => {
      expect(htmlEscape('<script>alert("test & \'")</script>')).toBe(
        '&lt;script&gt;alert(&quot;test &amp; &#39;&quot;)&lt;/script&gt;',
      );
    });

    it('returns empty string for null or undefined', () => {
      expect(htmlEscape(null)).toBe('');
      expect(htmlEscape(undefined)).toBe('');
    });
  });

  describe('sendHelpDispatchEmail', () => {
    it('sends email successfully', async () => {
      const sendMock = new Resend('dummy').emails.send as any;
      sendMock.mockResolvedValueOnce({ id: 'test-id' });

      // We need to re-import the module to pick up the new env variables
      const { sendHelpDispatchEmail: sendEmail } = await import('./email');

      const result = await sendEmail({
        to: 'test@example.com',
        mentorHandle: 'mentor',
        menteeHandle: 'mentee',
        prUrl: 'https://github.com/test/test/pull/1',
        helpReason: 'Need help with tests',
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: '[MergeShip] Someone needs your help on a PR',
          html: expect.stringContaining('Need help with tests'),
        }),
      );
      expect(result).toEqual({ id: 'test-id' });
    });

    it('skips sending if RESEND_API_KEY is not set', async () => {
      process.env.RESEND_API_KEY = '';

      const { sendHelpDispatchEmail: sendEmail } = await import('./email');
      const result = await sendEmail({
        to: 'test@example.com',
        mentorHandle: 'mentor',
        menteeHandle: 'mentee',
        prUrl: 'https://github.com/test/test/pull/1',
      });

      expect(result).toEqual({ skipped: true });
    });
  });

  describe('sendMentorAssignedEmail', () => {
    it('sends email successfully', async () => {
      const sendMock = new Resend('dummy').emails.send as any;
      sendMock.mockResolvedValueOnce({ id: 'test-id2' });

      const { sendMentorAssignedEmail: sendEmail } = await import('./email');

      const result = await sendEmail({
        to: 'test@example.com',
        mentorHandle: 'mentor',
        authorHandle: 'author',
        prUrl: 'https://github.com/test/test/pull/1',
        prTitle: 'Fix tests',
        repo: 'test/test',
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining("You've been assigned as mentor on"),
        }),
      );
      expect(result).toEqual({ id: 'test-id2' });
    });
  });

  describe('sendWeeklyDigestEmail', () => {
    it('sends email successfully', async () => {
      const sendMock = new Resend('dummy').emails.send as any;
      sendMock.mockResolvedValueOnce({ id: 'test-id3' });

      const { sendWeeklyDigestEmail: sendEmail } = await import('./email');

      const result = await sendEmail({
        to: 'test@example.com',
        githubHandle: 'user',
        xpGained: 100,
        currentLevel: 2,
        xpToNextLevel: 50,
        issuesCompleted: 1,
        prsMerged: 1,
        reviewsPerformed: 1,
        recommendations: [{ title: 'Test Issue', url: 'https://github.com/test', xpReward: 50 }],
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: '[MergeShip] Your Weekly Contributor Digest',
          html: expect.stringContaining('Test Issue'),
        }),
      );
      expect(result).toEqual({ id: 'test-id3' });
    });
  });

  describe('sendOrganizationInviteEmail', () => {
    it('sends email successfully', async () => {
      const sendMock = new Resend('dummy').emails.send as any;
      sendMock.mockResolvedValueOnce({ id: 'test-id4' });

      const { sendOrganizationInviteEmail: sendEmail } = await import('./email');

      const result = await sendEmail({
        to: 'test@example.com',
        inviteLink: 'https://mergeship.com/invite/123',
        inviterHandle: 'admin',
        organizationName: 'Test Org',
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('admin invited you to join Test Org'),
        }),
      );
      expect(result).toEqual({ id: 'test-id4' });
    });
  });
});
