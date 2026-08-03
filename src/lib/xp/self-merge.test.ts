import { describe, it, expect } from 'vitest';
import { isSelfMerge } from './self-merge';

describe('isSelfMerge', () => {
  it('matches the repo owner case-insensitively', () => {
    expect(isSelfMerge('Owner/Repo', 'owner')).toBe(true);
    expect(isSelfMerge('owner/repo', 'OWNER')).toBe(true);
  });

  it('does not match a non-owner author', () => {
    expect(isSelfMerge('owner/repo', 'contributor')).toBe(false);
  });

  it('is false for missing inputs', () => {
    expect(isSelfMerge('', 'owner')).toBe(false);
    expect(isSelfMerge('owner/repo', '')).toBe(false);
    expect(isSelfMerge('norepo', 'norepo')).toBe(false);
  });
});
