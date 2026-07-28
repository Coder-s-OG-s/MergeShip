import { describe, expect, it } from 'vitest';
import { getPrStats, getDaysElapsed, getReviewState } from './github-prs-panel';

describe('github-prs-panel helpers', () => {
  describe('getPrStats', () => {
    it('returns deterministic additions and deletions based on prNumber', () => {
      const stats1 = getPrStats(123);
      const stats2 = getPrStats(123);
      expect(stats1).toEqual(stats2);
      expect(stats1.additions).toBe(((123 * 17) % 480) + 12);
      expect(stats1.deletions).toBe(((123 * 7) % 220) + 3);
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
