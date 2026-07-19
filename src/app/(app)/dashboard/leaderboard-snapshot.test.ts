import { describe, expect, it } from 'vitest';
import { getDisplayProfiles } from './leaderboard-snapshot';

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
});
