import { describe, expect, it } from 'vitest';
import { canVerifyLinkedPr, type LinkedRec } from './my-work-section';

const baseRec: LinkedRec = {
  id: 1,
  linked_pr_url: 'https://github.com/org/repo/pull/12',
  status: 'claimed',
  xp_reward: 100,
  issue_id: 10,
  issue: {
    title: 'Fix thing',
    repo_full_name: 'org/repo',
    url: 'https://github.com/org/repo/issues/1',
  },
  pr: {
    id: 20,
    author_user_id: 'contributor-1',
    mentor_verified: false,
    state: 'open',
    can_verify: true,
  },
};

describe('canVerifyLinkedPr', () => {
  it('allows L2 maintainers to verify another user open PR', () => {
    expect(canVerifyLinkedPr(baseRec, { id: 'mentor-1', level: 2 })).toBe(true);
  });

  it('hides verify action for L2 users who do not maintain the PR repository', () => {
    expect(
      canVerifyLinkedPr(
        { ...baseRec, pr: baseRec.pr ? { ...baseRec.pr, can_verify: false } : null },
        { id: 'mentor-1', level: 2 },
      ),
    ).toBe(false);
  });

  it('hides verify action for the PR author', () => {
    expect(canVerifyLinkedPr(baseRec, { id: 'contributor-1', level: 3 })).toBe(false);
  });
});
