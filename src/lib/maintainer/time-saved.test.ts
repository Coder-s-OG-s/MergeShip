import { describe, expect, it } from 'vitest';
import { computeTimeSaved } from './time-saved';

describe('computeTimeSaved', () => {
  it('handles zero inputs gracefully', () => {
    const res = computeTimeSaved({
      aiBlockedPrs: 0,
      mentorVerifiedPrs: 0,
      autoTriagedIssues: 0,
      daysInRange: 30,
    });

    expect(res).toEqual({
      aiFilteringHours: 0,
      chainReviewsHours: 0,
      autoTriageHours: 0,
      totalHours: 0,
      projectedAnnualHours: 0,
    });
  });

  it('computes correct typical values', () => {
    // aiBlockedPrs = 10 -> 10 * 45 / 60 = 7.5 hrs
    // mentorVerifiedPrs = 5 -> 5 * 30 / 60 = 2.5 hrs
    // autoTriagedIssues = 8 -> 8 * 10 / 60 = 1.3333333333333333 hrs
    // totalHours = 11.333333333333334
    // projectedAnnualHours = (11.333333333333334 / 30) * 365 = 137.8888 -> rounded to 138
    const res = computeTimeSaved({
      aiBlockedPrs: 10,
      mentorVerifiedPrs: 5,
      autoTriagedIssues: 8,
      daysInRange: 30,
    });

    expect(res.aiFilteringHours).toBe(7.5);
    expect(res.chainReviewsHours).toBe(2.5);
    expect(res.autoTriageHours).toBeCloseTo(1.3333, 4);
    expect(res.totalHours).toBeCloseTo(11.3333, 4);
    expect(res.projectedAnnualHours).toBe(138);
  });

  it('rounds projectedAnnualHours to the nearest integer correctly', () => {
    // 0.4 total hours over 30 days -> (0.4 / 30) * 365 = 4.8666 -> rounds to 5
    const roundUp = computeTimeSaved({
      aiBlockedPrs: 0,
      mentorVerifiedPrs: 0,
      autoTriagedIssues: 2, // 2 * 10 / 60 = 0.3333 hrs
      daysInRange: 30,
    });
    expect(roundUp.projectedAnnualHours).toBe(4); // 0.33333 / 30 * 365 = 4.05 -> rounds to 4

    // Let's test a case that rounds up specifically:
    // total hours = 0.38
    // daysInRange = 10
    // (0.38 / 10) * 365 = 13.87 -> rounds to 14
    const roundDown = computeTimeSaved({
      aiBlockedPrs: 0,
      mentorVerifiedPrs: 0,
      autoTriagedIssues: 2, // 2 * 10 / 60 = 0.33333 hrs
      daysInRange: 10,
    });
    // 0.33333 / 10 * 365 = 12.16 -> rounds to 12
    expect(roundDown.projectedAnnualHours).toBe(12);

    const roundUpExact = computeTimeSaved({
      aiBlockedPrs: 1, // 45 mins = 0.75 hrs
      mentorVerifiedPrs: 0,
      autoTriagedIssues: 0,
      daysInRange: 10,
    });
    // 0.75 / 10 * 365 = 27.375 -> rounds to 27
    expect(roundUpExact.projectedAnnualHours).toBe(27);
  });

  it('prevents division by zero when daysInRange is 0', () => {
    const res = computeTimeSaved({
      aiBlockedPrs: 10,
      mentorVerifiedPrs: 5,
      autoTriagedIssues: 8,
      daysInRange: 0,
    });

    expect(res.projectedAnnualHours).toBe(0);
  });
});
