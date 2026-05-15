import { describe, it, expect } from 'vitest';
import {
  buildMentorCommentBody,
  decideMentorCommentAction,
  type MentorCommentContext,
} from './mentor-comment';

describe('buildMentorCommentBody', () => {
  it('produces a one-line GitHub-friendly message', () => {
    const out = buildMentorCommentBody({ reviewerHandle: 'alice', reviewerLevel: 2 });
    expect(out).toContain('@alice');
    expect(out).toContain('L2');
    expect(out).toMatch(/Reviewed by MergeShip mentor/);
    expect(out.split('\n').length).toBeLessThanOrEqual(2);
  });

  it('includes the level in the body for higher levels', () => {
    expect(buildMentorCommentBody({ reviewerHandle: 'carol', reviewerLevel: 3 })).toContain('L3');
  });
});

describe('decideMentorCommentAction', () => {
  const base: MentorCommentContext = {
    isDraft: false,
    state: 'open',
    existingCommentId: null,
    existingMentorLevel: null,
    newMentorLevel: 2,
  };

  it('posts a new comment when none exists', () => {
    expect(decideMentorCommentAction(base)).toBe('post');
  });

  it('does nothing on draft PRs (defer to ready_for_review)', () => {
    expect(decideMentorCommentAction({ ...base, isDraft: true })).toBe('skip');
  });

  it('does nothing on closed PRs', () => {
    expect(decideMentorCommentAction({ ...base, state: 'closed' })).toBe('skip');
  });

  it('does nothing on merged PRs', () => {
    expect(decideMentorCommentAction({ ...base, state: 'merged' })).toBe('skip');
  });

  it('updates existing comment when the new reviewer outranks the old', () => {
    expect(
      decideMentorCommentAction({
        ...base,
        existingCommentId: 9001,
        existingMentorLevel: 2,
        newMentorLevel: 3,
      }),
    ).toBe('update');
  });

  it('does nothing when same-level mentor re-reviews', () => {
    expect(
      decideMentorCommentAction({
        ...base,
        existingCommentId: 9001,
        existingMentorLevel: 2,
        newMentorLevel: 2,
      }),
    ).toBe('skip');
  });

  it('does nothing on downgrade (never replace a higher-level mentor)', () => {
    expect(
      decideMentorCommentAction({
        ...base,
        existingCommentId: 9001,
        existingMentorLevel: 3,
        newMentorLevel: 2,
      }),
    ).toBe('skip');
  });

  it('posts a fresh comment when existingMentorLevel is set but commentId is null (older row before this feature)', () => {
    expect(
      decideMentorCommentAction({
        ...base,
        existingCommentId: null,
        existingMentorLevel: 2,
        newMentorLevel: 2,
      }),
    ).toBe('post');
  });
});
