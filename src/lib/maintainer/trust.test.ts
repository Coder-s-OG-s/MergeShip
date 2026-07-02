import { describe, it, expect } from 'vitest';
import { computeTrustScore, buildTrustSegments } from './trust';

describe('computeTrustScore', () => {
  it('caps at 100 and floor at 0', () => {
    // High values
    expect(
      computeTrustScore({
        level: 4,
        mergedPrs: 50,
        issuesSolved: 20,
        githubStreak: 30,
        aiFlaggedPrCount: 0,
      }),
    ).toBe(100);

    // Low values / high penalties
    expect(
      computeTrustScore({
        level: 0,
        mergedPrs: 0,
        issuesSolved: 0,
        githubStreak: 0,
        aiFlaggedPrCount: 5,
      }),
    ).toBe(0);
  });

  it('calculates expected trust score components correctly', () => {
    // Level 1 (15) + 3 PRs (9) + 2 issues (4) + 6 streak (2) - 0 penalty = 30
    expect(
      computeTrustScore({
        level: 1,
        mergedPrs: 3,
        issuesSolved: 2,
        githubStreak: 6,
        aiFlaggedPrCount: 0,
      }),
    ).toBe(30);

    // Level 2 (30) + 10 PRs (30 max) + 5 issues (10) + 9 streak (3) - 1 AI PR (20) = 53
    expect(
      computeTrustScore({
        level: 2,
        mergedPrs: 10,
        issuesSolved: 5,
        githubStreak: 9,
        aiFlaggedPrCount: 1,
      }),
    ).toBe(53);
  });
});

describe('buildTrustSegments', () => {
  it('correctly groups scores', () => {
    const scores = [95, 80, 75, 60, 50, 40, 39, 10];
    const segments = buildTrustSegments(scores);
    expect(segments).toEqual({
      '80-100': 2,
      '60-79': 2,
      '40-59': 2,
      '0-39': 2,
    });
  });
});
