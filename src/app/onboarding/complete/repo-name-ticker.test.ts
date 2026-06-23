import { describe, expect, it } from 'vitest';
import { nextRepoIndex, normalizeRepoNames, staticRepoNameText } from './repo-name-ticker';

describe('repo name ticker helpers', () => {
  it('trims repo names, removes blanks, and preserves first-seen order', () => {
    expect(normalizeRepoNames([' kyverno/kyverno ', '', 'kyverno/policy-reporter'])).toEqual([
      'kyverno/kyverno',
      'kyverno/policy-reporter',
    ]);
  });

  it('dedupes repeated repo names', () => {
    expect(normalizeRepoNames(['org/repo', 'org/repo', 'org/other'])).toEqual([
      'org/repo',
      'org/other',
    ]);
  });

  it('loops to the first repo after the last repo', () => {
    expect(nextRepoIndex(0, 3)).toBe(1);
    expect(nextRepoIndex(2, 3)).toBe(0);
  });

  it('keeps static mode on the first item for empty and single-name lists', () => {
    expect(nextRepoIndex(0, 0)).toBe(0);
    expect(nextRepoIndex(0, 1)).toBe(0);
  });

  it('formats the reduced-motion static text', () => {
    expect(staticRepoNameText(['org/repo', 'org/other'])).toBe('org/repo, org/other');
    expect(staticRepoNameText([], 'None')).toBe('None');
  });
});
