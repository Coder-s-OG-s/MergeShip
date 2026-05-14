import { describe, it, expect } from 'vitest';
import { prTier, comparePrRows, validateFilters, type MaintainerPrRow } from './queue';

const row = (overrides: Partial<MaintainerPrRow>): MaintainerPrRow => ({
  id: 1,
  repoFullName: 'acme/api',
  number: 1,
  title: 't',
  url: 'https://github.com/acme/api/pull/1',
  state: 'open',
  draft: false,
  authorLogin: 'a',
  authorLevel: null,
  authorXp: null,
  authorMergedPrs: null,
  mentorVerified: false,
  mentorReviewerHandle: null,
  mentorReviewerLevel: null,
  githubUpdatedAt: '2026-05-14T00:00:00Z',
  ...overrides,
});

describe('prTier', () => {
  it('tier 1: open + verified + L1+', () => {
    expect(prTier(row({ state: 'open', mentorVerified: true, authorLevel: 1 }))).toBe(1);
    expect(prTier(row({ state: 'open', mentorVerified: true, authorLevel: 3 }))).toBe(1);
  });

  it('tier 2: open + verified + L0 or unknown', () => {
    expect(prTier(row({ state: 'open', mentorVerified: true, authorLevel: 0 }))).toBe(2);
    expect(prTier(row({ state: 'open', mentorVerified: true, authorLevel: null }))).toBe(2);
  });

  it('tier 3: open + unverified + L2+', () => {
    expect(prTier(row({ state: 'open', mentorVerified: false, authorLevel: 2 }))).toBe(3);
    expect(prTier(row({ state: 'open', mentorVerified: false, authorLevel: 3 }))).toBe(3);
  });

  it('tier 4: open + unverified + L1', () => {
    expect(prTier(row({ state: 'open', mentorVerified: false, authorLevel: 1 }))).toBe(4);
  });

  it('tier 5: open + unverified + L0 or unknown', () => {
    expect(prTier(row({ state: 'open', mentorVerified: false, authorLevel: 0 }))).toBe(5);
    expect(prTier(row({ state: 'open', mentorVerified: false, authorLevel: null }))).toBe(5);
  });

  it('tier 6: closed and merged regardless of verification', () => {
    expect(prTier(row({ state: 'closed' }))).toBe(6);
    expect(prTier(row({ state: 'merged' }))).toBe(6);
    expect(prTier(row({ state: 'merged', mentorVerified: true, authorLevel: 3 }))).toBe(6);
  });
});

describe('comparePrRows', () => {
  it('lower tier sorts first', () => {
    const verified = row({ mentorVerified: true, authorLevel: 1 }); // tier 1
    const unverified = row({ mentorVerified: false, authorLevel: 3 }); // tier 3
    expect(comparePrRows(verified, unverified)).toBeLessThan(0);
  });

  it('within tier, newer updated_at first', () => {
    const newer = row({ githubUpdatedAt: '2026-05-14T10:00:00Z' });
    const older = row({ githubUpdatedAt: '2026-05-13T10:00:00Z' });
    expect(comparePrRows(newer, older)).toBeLessThan(0);
  });

  it('within tier + same time, higher id first (newest insert)', () => {
    const a = row({ id: 100 });
    const b = row({ id: 50 });
    expect(comparePrRows(a, b)).toBeLessThan(0);
  });
});

describe('validateFilters', () => {
  it('passes through known fields', () => {
    const out = validateFilters({ state: ['open', 'merged'], authorLevel: [0, 1, 2] });
    expect(out.state).toEqual(['open', 'merged']);
    expect(out.authorLevel).toEqual([0, 1, 2]);
  });

  it('rejects unknown state', () => {
    const out = validateFilters({ state: ['open', 'banana' as never] });
    expect(out.state).toEqual(['open']);
  });

  it('rejects out-of-range author levels', () => {
    const out = validateFilters({ authorLevel: [0, 7, -1] as never });
    expect(out.authorLevel).toEqual([0]);
  });

  it('mentorVerified defaults to "either"', () => {
    expect(validateFilters({}).mentorVerified).toBe('either');
    expect(validateFilters({ mentorVerified: 'yes' }).mentorVerified).toBe('yes');
    expect(validateFilters({ mentorVerified: 'sometimes' as never }).mentorVerified).toBe('either');
  });

  it('repos: keep strings, drop non-strings', () => {
    const out = validateFilters({ repos: ['acme/api', 42 as never, 'acme/web'] });
    expect(out.repos).toEqual(['acme/api', 'acme/web']);
  });
});
