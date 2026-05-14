import { describe, it, expect } from 'vitest';
import { classifyTriage, STALE_DAYS, type IssueTriageInput } from './issue-triage';

const now = new Date('2026-05-14T00:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000);

const base: IssueTriageInput = {
  state: 'open',
  assigneeLogin: null,
  labels: [],
  lastEventAt: daysAgo(1),
  githubCreatedAt: daysAgo(1),
};

describe('classifyTriage', () => {
  it('returns closed for closed issues regardless of other fields', () => {
    expect(classifyTriage({ ...base, state: 'closed' }, now)).toBe('closed');
  });

  it('flags open + no assignee + no triage label as needs-triage', () => {
    expect(classifyTriage(base, now)).toBe('needs-triage');
  });

  it('treats an open issue with an assignee as in-progress', () => {
    expect(classifyTriage({ ...base, assigneeLogin: 'alice' }, now)).toBe('in-progress');
  });

  it('treats "good first issue" label as triaged', () => {
    expect(classifyTriage({ ...base, labels: ['good first issue'] }, now)).toBe('in-progress');
  });

  it('matches triage labels case-insensitively', () => {
    expect(classifyTriage({ ...base, labels: ['Help Wanted'] }, now)).toBe('in-progress');
  });

  it('flags an assigned-but-untouched-for-STALE_DAYS issue as stale', () => {
    const stale = daysAgo(STALE_DAYS + 1);
    expect(
      classifyTriage(
        { ...base, assigneeLogin: 'alice', lastEventAt: stale, githubCreatedAt: stale },
        now,
      ),
    ).toBe('stale');
  });

  it('falls back to githubCreatedAt when lastEventAt is null', () => {
    const old = daysAgo(STALE_DAYS + 1);
    expect(
      classifyTriage(
        { ...base, assigneeLogin: 'alice', lastEventAt: null, githubCreatedAt: old },
        now,
      ),
    ).toBe('stale');
  });

  it('returns in-progress at exactly the stale boundary (strict greater-than)', () => {
    const boundary = daysAgo(STALE_DAYS);
    expect(
      classifyTriage(
        { ...base, assigneeLogin: 'alice', lastEventAt: boundary, githubCreatedAt: boundary },
        now,
      ),
    ).toBe('in-progress');
  });

  it('still surfaces an unassigned issue as needs-triage even if old', () => {
    const old = daysAgo(STALE_DAYS + 10);
    expect(
      classifyTriage({ ...base, assigneeLogin: null, lastEventAt: old, githubCreatedAt: old }, now),
    ).toBe('needs-triage');
  });

  it('handles null labels array as no labels', () => {
    expect(classifyTriage({ ...base, labels: null }, now)).toBe('needs-triage');
  });
});
