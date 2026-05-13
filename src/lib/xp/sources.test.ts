import { describe, it, expect } from 'vitest';
import { XP_REWARDS, DAILY_CAPS, XP_SOURCE, refIds, xpForMerge } from './sources';

describe('xpForMerge', () => {
  it('maps E/M/H to declared rewards', () => {
    expect(xpForMerge('E')).toBe(XP_REWARDS.RECOMMENDED_MERGE.E);
    expect(xpForMerge('M')).toBe(XP_REWARDS.RECOMMENDED_MERGE.M);
    expect(xpForMerge('H')).toBe(XP_REWARDS.RECOMMENDED_MERGE.H);
  });
});

describe('refIds — idempotency key shapes', () => {
  it('pr', () => {
    expect(refIds.pr('foo/bar', 42)).toBe('pr:foo/bar:42');
  });
  it('issue', () => {
    expect(refIds.issue('foo/bar', 7)).toBe('issue:foo/bar:7');
  });
  it('comment', () => {
    expect(refIds.comment('foo/bar', 1, 9)).toBe('comment:foo/bar:1:9');
  });
  it('review', () => {
    expect(refIds.review('foo/bar', 1, 'alice')).toBe('review:foo/bar:1:alice');
  });
  it('helpReview', () => {
    expect(refIds.helpReview(99, 'bob')).toBe('help-review:99:bob');
  });
  it('audit', () => {
    expect(refIds.audit('1234')).toBe('audit:1234');
  });
  it('streak', () => {
    expect(refIds.streak('2026-05-12')).toBe('streak:2026-05-12');
  });
  it('firstTime', () => {
    expect(refIds.firstTime('merge')).toBe('first:merge');
  });
});

describe('constants — sanity', () => {
  it('exposes daily caps', () => {
    expect(DAILY_CAPS.ISSUES_OPENED).toBeGreaterThan(0);
    expect(DAILY_CAPS.TOTAL_XP_TRIPWIRE).toBeGreaterThan(0);
  });
  it('exposes source names as strings', () => {
    expect(typeof XP_SOURCE.GITHUB_AUDIT).toBe('string');
    expect(typeof XP_SOURCE.RECOMMENDED_MERGE).toBe('string');
  });
});
