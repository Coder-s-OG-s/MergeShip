import { describe, expect, it } from 'vitest';
import { pickMentor, shouldAutoAssignMentor, type SeniorMaintainer } from './mentor-assign';

describe('shouldAutoAssignMentor', () => {
  it('assigns authors below the minimum contributor level', () => {
    expect(shouldAutoAssignMentor(0, 2)).toBe(true);
    expect(shouldAutoAssignMentor(1, 2)).toBe(true);
  });

  it('does not assign authors at or above the gate', () => {
    expect(shouldAutoAssignMentor(2, 2)).toBe(false);
    expect(shouldAutoAssignMentor(3, 2)).toBe(false);
  });

  it('does not assign unknown authors', () => {
    expect(shouldAutoAssignMentor(null, 2)).toBe(false);
  });
});

describe('pickMentor', () => {
  it('returns null for an empty senior list', () => {
    expect(pickMentor([])).toBeNull();
  });

  it('picks the maintainer with the fewest active reviews', () => {
    const seniors: SeniorMaintainer[] = [
      { userId: 'user-3', handle: 'carol', activeReviewCount: 2 },
      { userId: 'user-1', handle: 'alice', activeReviewCount: 1 },
      { userId: 'user-2', handle: 'bob', activeReviewCount: 0 },
    ];
    expect(pickMentor(seniors)).toEqual({ userId: 'user-2', handle: 'bob', activeReviewCount: 0 });
  });

  it('falls back to stable handle order on tied active reviews', () => {
    const seniors: SeniorMaintainer[] = [
      { userId: 'user-3', handle: 'carol', activeReviewCount: 1 },
      { userId: 'user-1', handle: 'alice', activeReviewCount: 1 },
      { userId: 'user-2', handle: 'bob', activeReviewCount: 2 },
    ];
    expect(pickMentor(seniors)).toEqual({
      userId: 'user-1',
      handle: 'alice',
      activeReviewCount: 1,
    });
  });

  it('excludes the PR author from assignment', () => {
    const seniors: SeniorMaintainer[] = [
      { userId: 'user-1', handle: 'alice', activeReviewCount: 0 },
      { userId: 'user-2', handle: 'bob', activeReviewCount: 0 },
    ];
    expect(pickMentor(seniors, 'user-1')).toEqual({
      userId: 'user-2',
      handle: 'bob',
      activeReviewCount: 0,
    });
  });
});
