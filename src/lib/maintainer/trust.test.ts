import { describe, it, expect } from 'vitest';
import { computeTrustScore } from './trust';

describe('computeTrustScore', () => {
  it('should return 0 for zero, negative, or non-finite values', () => {
    expect(computeTrustScore(0, 0, 0, 0)).toBe(0);
    expect(computeTrustScore(-1, -100, -5, -10)).toBe(0);
    expect(computeTrustScore(NaN, 0, 0, 0)).toBe(0);
  });

  it('should return 100 for maximum/saturated values', () => {
    expect(computeTrustScore(5, 5000, 10, 90)).toBe(100);
    expect(computeTrustScore(6, 6000, 15, 100)).toBe(100);
  });

  it('should calculate level weighting correctly', () => {
    // Level weight is 40% (normalized level / 5).
    expect(computeTrustScore(5, 0, 0, 0)).toBe(40);
    expect(computeTrustScore(2.5, 0, 0, 0)).toBe(20);
    expect(computeTrustScore(1, 0, 0, 0)).toBe(8);
  });

  it('should calculate XP weighting correctly', () => {
    // XP weight is 20% (normalized xp / 5000).
    expect(computeTrustScore(0, 5000, 0, 0)).toBe(20);
    expect(computeTrustScore(0, 2500, 0, 0)).toBe(10);
  });

  it('should calculate merged PRs weighting correctly', () => {
    // Merged PRs weight is 30% (normalized merged / 10).
    expect(computeTrustScore(0, 0, 10, 0)).toBe(30);
    expect(computeTrustScore(0, 0, 5, 0)).toBe(15);
  });

  it('should calculate account age weighting correctly', () => {
    // Account age weight is 10% (normalized days / 90).
    expect(computeTrustScore(0, 0, 0, 90)).toBe(10);
    expect(computeTrustScore(0, 0, 0, 45)).toBe(5);
  });

  it('should handle intermediate values and round correctly', () => {
    // Level 3 (3/5 * 40 = 24)
    // XP 2000 (2000/5000 * 20 = 8)
    // Merged 3 (3/10 * 30 = 9)
    // Age 30 (30/90 * 10 = 3.33)
    // Total = 24 + 8 + 9 + 3.33 = 44.33 -> round to 44
    expect(computeTrustScore(3, 2000, 3, 30)).toBe(44);

    // Level 4 (4/5 * 40 = 32)
    // XP 4000 (4000/5000 * 20 = 16)
    // Merged 8 (8/10 * 30 = 24)
    // Age 80 (80/90 * 10 = 8.89)
    // Total = 32 + 16 + 24 + 8.89 = 80.89 -> round to 81
    expect(computeTrustScore(4, 4000, 8, 80)).toBe(81);
  });
});
