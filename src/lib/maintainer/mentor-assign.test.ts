import { describe, expect, it } from 'vitest';
import { pickMentor, shouldAutoAssignMentor, type SeniorMaintainer } from './mentor-assign';

const SENIORS: SeniorMaintainer[] = [
  { userId: 'user-3', handle: 'carol' },
  { userId: 'user-1', handle: 'alice' },
  { userId: 'user-2', handle: 'bob' },
];

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

  it('picks the first maintainer by stable handle order', () => {
    expect(pickMentor(SENIORS)).toEqual({ userId: 'user-1', handle: 'alice' });
  });

  it('excludes the PR author from assignment', () => {
    expect(pickMentor(SENIORS, 'user-1')).toEqual({ userId: 'user-2', handle: 'bob' });
  });
});
