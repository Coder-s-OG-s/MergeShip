import { describe, expect, it } from 'vitest';
import { getPrStats, getDaysElapsed, getReviewState } from './github-prs-panel';

describe('github-prs-panel helpers', () => {
  describe('getPrStats', () => {
    it('returns GitHub-supplied additions and deletions', () => {
      expect(getPrStats({ additions: 42, deletions: 7 })).toEqual({
        additions: 42,
        deletions: 7,
      });
    });

    it('returns zero counts when GitHub reports empty diffs', () => {
      expect(getPrStats({ additions: 0, deletions: 0 })).toEqual({
        additions: 0,
        deletions: 0,
      });
    });

    it('returns null when line-change data has not been synced', () => {
      expect(getPrStats({})).toBeNull();
      expect(getPrStats({ additions: null, deletions: null })).toBeNull();
      expect(getPrStats({ additions: 12, deletions: null })).toBeNull();
      expect(getPrStats({ additions: undefined, deletions: 3 })).toBeNull();
    });

    it('returns null for non-finite values', () => {
      expect(getPrStats({ additions: Number.NaN, deletions: 1 })).toBeNull();
      expect(getPrStats({ additions: 1, deletions: Number.POSITIVE_INFINITY })).toBeNull();
    });
  });

  describe('getDaysElapsed', () => {
    it('calculates correct days difference', () => {
      const createdAt = '2026-07-10T12:00:00Z';
      const now = new Date('2026-07-16T15:00:00Z').getTime();
      expect(getDaysElapsed(createdAt, now)).toBe(6);
    });

    it('handles future dates gracefully by returning 0', () => {
      const createdAt = '2026-07-20T12:00:00Z';
      const now = new Date('2026-07-16T15:00:00Z').getTime();
      expect(getDaysElapsed(createdAt, now)).toBe(0);
    });
  });

  describe('getReviewState', () => {
    it('returns null for non-open states', () => {
      expect(getReviewState('merged', [])).toBeNull();
      expect(getReviewState('closed', [])).toBeNull();
    });

    it('returns CHANGES APPROVED if reviews contain approved', () => {
      const reviews = [{ state: 'commented' }, { state: 'approved' }];
      expect(getReviewState('open', reviews)).toBe('CHANGES APPROVED');
    });

    it('returns CHANGES REQUESTED if reviews contain changes_requested and no approved', () => {
      const reviews = [{ state: 'commented' }, { state: 'changes_requested' }];
      expect(getReviewState('open', reviews)).toBe('CHANGES REQUESTED');
    });

    it('returns REVIEW REQUESTED if no review satisfies above conditions or reviews is empty', () => {
      expect(getReviewState('open', [])).toBe('REVIEW REQUESTED');
      expect(getReviewState('open', [{ state: 'commented' }])).toBe('REVIEW REQUESTED');
    });
  });
});
