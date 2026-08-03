import { describe, it, expect } from 'vitest';
import { notificationMessage, notificationLink } from './notifications';

describe('notificationMessage', () => {
  it('claim', () => {
    expect(notificationMessage('claim', { issueId: 5 })).toBe('You claimed an issue');
    expect(notificationMessage('claim', { recId: 5 })).toBe('You claimed an issue');
  });

  it('help_dispatch', () => {
    expect(notificationMessage('help_dispatch', { helpRequestId: 1 })).toBe(
      'A contributor requested your help reviewing a PR',
    );
  });

  it('mentor_comment_posted with repo/number', () => {
    expect(
      notificationMessage('mentor_comment_posted', {
        prId: 1,
        commentId: 2,
        repo: 'foo/bar',
        number: 42,
      }),
    ).toBe('Mentor feedback posted on foo/bar #42');
  });

  it('mentor_comment_posted falls back without repo/number', () => {
    expect(notificationMessage('mentor_comment_posted', {})).toBe(
      'Mentor feedback posted on your PR',
    );
  });

  it('mentor_comment_error', () => {
    expect(notificationMessage('mentor_comment_error', { prId: 1, error: 'boom' })).toBe(
      "MergeShip couldn't post mentor feedback on your PR",
    );
  });

  it('mentor_auto_assigned with title', () => {
    expect(
      notificationMessage('mentor_auto_assigned', {
        prUrl: 'https://github.com/foo/bar/pull/1',
        prTitle: 'Fix the thing',
        repo: 'foo/bar',
        prNumber: 1,
        authorLogin: 'someone',
      }),
    ).toBe('You were assigned as mentor for "Fix the thing"');
  });

  it('pr_merged with repo and xp', () => {
    expect(
      notificationMessage('pr_merged', { recId: 1, repo: 'foo/bar', prNumber: 9, xpAwarded: 50 }),
    ).toBe('Your PR merged in foo/bar (+50 XP)');
  });

  it('pr_merged without xp', () => {
    expect(notificationMessage('pr_merged', { recId: 1, repo: 'foo/bar', prNumber: 9 })).toBe(
      'Your PR merged in foo/bar',
    );
  });

  it('claim_reset_stale', () => {
    expect(notificationMessage('claim_reset_stale', { recId: 1 })).toBe(
      'Your claim was reset due to inactivity',
    );
  });

  it('claim_warning_stale with daysClaimed', () => {
    expect(notificationMessage('claim_warning_stale', { recId: 1, daysClaimed: 5 })).toBe(
      'Your claim is 5 days old \u2014 act soon or it may be reset',
    );
  });

  it('falls back to a humanized kind for unknown kinds', () => {
    expect(notificationMessage('some_future_kind', null)).toBe('some future kind');
  });

  it('handles null detail without throwing', () => {
    expect(() => notificationMessage('pr_merged', null)).not.toThrow();
  });
});

describe('notificationLink', () => {
  it('prefers an explicit prUrl when present', () => {
    expect(
      notificationLink('mentor_auto_assigned', {
        prUrl: 'https://github.com/foo/bar/pull/1',
        repo: 'foo/bar',
        prNumber: 1,
      }),
    ).toBe('https://github.com/foo/bar/pull/1');
  });

  it('builds a link from repo + number', () => {
    expect(notificationLink('mentor_comment_posted', { repo: 'foo/bar', number: 42 })).toBe(
      'https://github.com/foo/bar/pull/42',
    );
  });

  it('builds a link from repo + prNumber', () => {
    expect(notificationLink('pr_merged', { repo: 'foo/bar', prNumber: 9 })).toBe(
      'https://github.com/foo/bar/pull/9',
    );
  });

  it('returns null when there is not enough detail to build a link', () => {
    expect(notificationLink('claim', { issueId: 5 })).toBeNull();
    expect(notificationLink('claim_reset_stale', { recId: 1 })).toBeNull();
  });
});
