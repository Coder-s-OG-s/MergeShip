import { describe, it, expect } from 'vitest';
import { extractIssueNumbers } from './process-pr-event';

describe('extractIssueNumbers', () => {
  it('finds "closes #123"', () => {
    expect(extractIssueNumbers('closes #123')).toEqual([123]);
  });

  it('finds "fixes #45" and "resolves #67"', () => {
    expect(extractIssueNumbers('fixes #45 and resolves #67')).toEqual([45, 67]);
  });

  it('finds bare "#7" references', () => {
    expect(extractIssueNumbers('related to #7')).toEqual([7]);
  });

  it('dedupes repeated numbers', () => {
    expect(extractIssueNumbers('#5 #5 closes #5')).toEqual([5]);
  });

  it('ignores non-issue # like #foo', () => {
    expect(extractIssueNumbers('section #foo and #1')).toEqual([1]);
  });

  it('returns empty on null/empty', () => {
    expect(extractIssueNumbers(null)).toEqual([]);
    expect(extractIssueNumbers('')).toEqual([]);
    expect(extractIssueNumbers(undefined)).toEqual([]);
  });

  it('case-insensitive', () => {
    expect(extractIssueNumbers('CLOSES #99')).toEqual([99]);
    expect(extractIssueNumbers('Fixed #100')).toEqual([100]);
  });
});
