import { describe, expect, it } from 'vitest';
import { normalizeRepoFilter, repoFilterPattern } from './issues-helpers';

describe('issue repo filtering helpers', () => {
  it('trims repo filters and treats blank input as unset', () => {
    expect(normalizeRepoFilter('  AYUSH-PATEL-56/KYVERNO  ')).toBe('AYUSH-PATEL-56/KYVERNO');
    expect(normalizeRepoFilter('   ')).toBeNull();
    expect(normalizeRepoFilter()).toBeNull();
  });

  it('escapes wildcard characters before using an ilike repo filter', () => {
    expect(repoFilterPattern('owner/repo_name')).toBe('owner/repo\\_name');
    expect(repoFilterPattern('owner/100%coverage')).toBe('owner/100\\%coverage');
    expect(repoFilterPattern('owner\\repo')).toBe('owner\\\\repo');
  });
});
