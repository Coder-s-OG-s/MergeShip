import { describe, expect, it } from 'vitest';
import { getDisplayProfiles, getRankContext } from './leaderboard-snapshot';

describe('leaderboard-snapshot helpers', () => {
  const generateProfiles = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      github_handle: `user-${i + 1}`,
      xp: 1000 - i * 100,
      level: 2,
      rank: i + 1,
    }));

  describe('getDisplayProfiles', () => {
    it('returns top 5 profiles if user is not in the list (myIndex === -1)', () => {
      const profiles = generateProfiles(10);
      const result = getDisplayProfiles(profiles, -1, 5);
      expect(result).toHaveLength(5);
      expect(result[0]?.github_handle).toBe('user-1');
      expect(result[4]?.github_handle).toBe('user-5');
    });

    it('returns all profiles if total profiles is less than or equal to limit', () => {
      const profiles = generateProfiles(3);
      const result = getDisplayProfiles(profiles, 1, 5);
      expect(result).toHaveLength(3);
      expect(result[0]?.github_handle).toBe('user-1');
    });

    it('returns top 5 profiles if user rank is within top 3 (myIndex <= 2)', () => {
      const profiles = generateProfiles(10);
      const result = getDisplayProfiles(profiles, 2, 5); // index 2 is rank 3 (user-3)
      expect(result).toHaveLength(5);
      expect(result[0]?.github_handle).toBe('user-1');
      expect(result[4]?.github_handle).toBe('user-5');
    });

    it('returns bottom 5 profiles if user rank is within bottom 3 (myIndex >= length - 3)', () => {
      const profiles = generateProfiles(10);
      const result = getDisplayProfiles(profiles, 8, 5); // index 8 is rank 9 (user-9)
      expect(result).toHaveLength(5);
      expect(result[0]?.github_handle).toBe('user-6');
      expect(result[4]?.github_handle).toBe('user-10');
    });

    it('returns middle 5 profiles (centered around user) if user is in the middle', () => {
      const profiles = generateProfiles(10);
      const result = getDisplayProfiles(profiles, 5, 5); // index 5 is rank 6 (user-6)
      expect(result).toHaveLength(5);
      // slice(3, 8) -> indices 3, 4, 5, 6, 7 (ranks 4, 5, 6, 7, 8)
      expect(result[0]?.github_handle).toBe('user-4');
      expect(result[2]?.github_handle).toBe('user-6'); // middle element
      expect(result[4]?.github_handle).toBe('user-8');
    });
  });

  describe('getRankContext', () => {
    it('returns null userRank when user is not in the tier (myIndex === -1)', () => {
      const profiles = generateProfiles(10);
      const ctx = getRankContext(profiles, -1);
      expect(ctx.userRank).toBeNull();
      expect(ctx.totalInTier).toBe(10);
      expect(ctx.gapToTop).toBeNull();
      expect(ctx.isTierLeader).toBe(false);
    });

    it('reports rank 1 and isTierLeader when the user is at the top of the tier', () => {
      const profiles = generateProfiles(8);
      const ctx = getRankContext(profiles, 0);
      expect(ctx.userRank).toBe(1);
      expect(ctx.totalInTier).toBe(8);
      expect(ctx.gapToTop).toBe(0);
      expect(ctx.isTierLeader).toBe(true);
    });

    it('reports correct rank and gap to the top for a mid-tier user', () => {
      const profiles = generateProfiles(20);
      // rank 7 (index 6) -> gap to top is 6
      const ctx = getRankContext(profiles, 6);
      expect(ctx.userRank).toBe(7);
      expect(ctx.totalInTier).toBe(20);
      expect(ctx.gapToTop).toBe(6);
      expect(ctx.isTierLeader).toBe(false);
    });

    it('reports correct rank for the bottom of the tier', () => {
      const profiles = generateProfiles(15);
      const ctx = getRankContext(profiles, 14);
      expect(ctx.userRank).toBe(15);
      expect(ctx.totalInTier).toBe(15);
      expect(ctx.gapToTop).toBe(14);
      expect(ctx.isTierLeader).toBe(false);
    });

    it('handles empty tier gracefully', () => {
      const ctx = getRankContext([], -1);
      expect(ctx.userRank).toBeNull();
      expect(ctx.totalInTier).toBe(0);
      expect(ctx.gapToTop).toBeNull();
      expect(ctx.isTierLeader).toBe(false);
    });

    it('handles a single-user tier where the user is the tier leader', () => {
      const profiles = generateProfiles(1);
      const ctx = getRankContext(profiles, 0);
      expect(ctx.userRank).toBe(1);
      expect(ctx.totalInTier).toBe(1);
      expect(ctx.gapToTop).toBe(0);
      expect(ctx.isTierLeader).toBe(true);
    });
  });
});
