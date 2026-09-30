import { describe, it, expect } from 'vitest';
import { normalizeRepoFilter, repoFilterPattern } from './issues-helpers';

describe('normalizeRepoFilter', () => {
  it('returns the value unchanged when it has no surrounding whitespace', () => {
    expect(normalizeRepoFilter('demo/sample-repo')).toBe('demo/sample-repo');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeRepoFilter('  demo/sample-repo  ')).toBe('demo/sample-repo');
  });

  it('trims tabs and newlines', () => {
    expect(normalizeRepoFilter('\tdemo/sample-repo\n')).toBe('demo/sample-repo');
  });

  it('preserves internal whitespace', () => {
    expect(normalizeRepoFilter('my org/my repo')).toBe('my org/my repo');
  });

  it('returns null for undefined', () => {
    expect(normalizeRepoFilter(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeRepoFilter('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(normalizeRepoFilter('   ')).toBeNull();
    expect(normalizeRepoFilter('\t\n')).toBeNull();
  });
});

describe('repoFilterPattern', () => {
  it('leaves plain values untouched', () => {
    expect(repoFilterPattern('demo/sample-repo')).toBe('demo/sample-repo');
  });

  it('escapes backslashes', () => {
    expect(repoFilterPattern('owner\\repo')).toBe('owner\\\\repo');
  });

  it('escapes percent signs', () => {
    expect(repoFilterPattern('100%')).toBe('100\\%');
  });

  it('escapes underscores', () => {
    expect(repoFilterPattern('my_repo')).toBe('my\\_repo');
  });

  it('escapes every special character in one pass', () => {
    expect(repoFilterPattern('a\\b%c_d')).toBe('a\\\\b\\%c\\_d');
  });

  it('escapes adjacent and repeated specials', () => {
    expect(repoFilterPattern('%%__\\\\')).toBe('\\%\\%\\_\\_\\\\\\\\');
  });

  it('trims the input before escaping', () => {
    expect(repoFilterPattern('  my_repo  ')).toBe('my\\_repo');
  });

  it('returns null for undefined', () => {
    expect(repoFilterPattern(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(repoFilterPattern('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(repoFilterPattern('   ')).toBeNull();
  });
});
