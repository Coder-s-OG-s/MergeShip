import { describe, it, expect } from 'vitest';
import { computeAuditScore, type AuditSignals } from './audit';

const empty: AuditSignals = {
  accountAgeYears: 0,
  mergedPrs: 0,
  nonOwnMergedPrs: 0,
  closedIssues: 0,
  distinctLanguages: 0,
  yearlyContributions: 0,
  followers: 0,
};

describe('computeAuditScore', () => {
  it('all zeros -> 0', () => {
    expect(computeAuditScore(empty)).toBe(0);
  });

  it('caps account_age at 5 years', () => {
    expect(computeAuditScore({ ...empty, accountAgeYears: 20 })).toBe(100);
  });

  it('caps merged_prs at 50', () => {
    expect(computeAuditScore({ ...empty, mergedPrs: 1000 })).toBe(50 * 8);
  });

  it('non-own merged PRs are the dominant signal (weight 15)', () => {
    const score = computeAuditScore({ ...empty, nonOwnMergedPrs: 10 });
    expect(score).toBe(10 * 15);
  });

  it('caps non-own merged PRs at 30 -> 450 max', () => {
    expect(computeAuditScore({ ...empty, nonOwnMergedPrs: 9999 })).toBe(450);
  });

  it('rounds languages to integer weight', () => {
    expect(computeAuditScore({ ...empty, distinctLanguages: 3 })).toBe(30);
  });

  it('yearly contributions scale at 0.3', () => {
    expect(computeAuditScore({ ...empty, yearlyContributions: 1000 })).toBe(300);
    expect(computeAuditScore({ ...empty, yearlyContributions: 100000 })).toBe(300);
  });

  it('senior dev composite is generous (~1100+)', () => {
    const score = computeAuditScore({
      accountAgeYears: 5,
      mergedPrs: 50,
      nonOwnMergedPrs: 20,
      closedIssues: 15,
      distinctLanguages: 5,
      yearlyContributions: 800,
      followers: 100,
    });
    // 100 + 400 + 300 + 75 + 50 + 240 + 50 = 1215
    expect(score).toBe(1215);
  });

  it('caps total at AUDIT_MAX', () => {
    const score = computeAuditScore({
      accountAgeYears: 10,
      mergedPrs: 100,
      nonOwnMergedPrs: 100,
      closedIssues: 100,
      distinctLanguages: 20,
      yearlyContributions: 5000,
      followers: 1000,
    });
    expect(score).toBe(1580); // hard cap from sources.ts
  });

  it('rejects negative inputs by clamping to 0', () => {
    expect(
      computeAuditScore({
        ...empty,
        mergedPrs: -5,
        nonOwnMergedPrs: -2,
      }),
    ).toBe(0);
  });
});
