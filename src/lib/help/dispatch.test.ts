import { describe, it, expect } from 'vitest';
import { rankReviewers, type ReviewerCandidate } from './dispatch';

const make = (over: Partial<ReviewerCandidate>): ReviewerCandidate => ({
  userId: 'u',
  level: 2,
  sameOrgReviewed: false,
  sameCohort: false,
  languageMatch: false,
  ...over,
});

describe('rankReviewers', () => {
  it('filters out anyone below L2', () => {
    const candidates = [make({ userId: 'a', level: 1 }), make({ userId: 'b', level: 2 })];
    const r = rankReviewers(candidates, { menteeLevel: 0 });
    expect(r.map((c) => c.userId)).toEqual(['b']);
  });

  it('filters reviewers at or below the mentee level', () => {
    const candidates = [
      make({ userId: 'a', level: 2 }),
      make({ userId: 'b', level: 3 }),
      make({ userId: 'c', level: 4 }),
    ];
    // mentee is L2 — reviewers must be L3+. L4 outranks L3 by ringScore.
    const r = rankReviewers(candidates, { menteeLevel: 2 });
    expect(r.map((c) => c.userId)).toEqual(['c', 'b']);
  });

  it('ring 1 (org reviewers) ranked first', () => {
    const candidates = [
      make({ userId: 'cohort-only', level: 3, sameCohort: true }),
      make({ userId: 'org-reviewer', level: 3, sameOrgReviewed: true }),
    ];
    const r = rankReviewers(candidates, { menteeLevel: 1 });
    expect(r[0]?.userId).toBe('org-reviewer');
  });

  it('ring 2 (cohort + lang match) ranked over ring 3', () => {
    const candidates = [
      make({ userId: 'broad', level: 3, sameCohort: true, languageMatch: false }),
      make({ userId: 'lang', level: 3, sameCohort: true, languageMatch: true }),
    ];
    const r = rankReviewers(candidates, { menteeLevel: 1 });
    expect(r[0]?.userId).toBe('lang');
  });

  it('caps at maxNotify', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      make({ userId: `r${i}`, level: 3, sameCohort: true }),
    );
    const r = rankReviewers(candidates, { menteeLevel: 1, maxNotify: 5 });
    expect(r).toHaveLength(5);
  });

  it('empty pool returns empty', () => {
    expect(rankReviewers([], { menteeLevel: 0 })).toEqual([]);
  });
});
