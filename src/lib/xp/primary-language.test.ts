import { describe, it, expect } from 'vitest';
import { pickPrimaryLanguage } from './primary-language';

describe('pickPrimaryLanguage', () => {
  it('picks the most-used language across repos', () => {
    const langs = ['TypeScript', 'TypeScript', 'TypeScript', 'Python', 'Python', 'Go'];
    expect(pickPrimaryLanguage(langs)).toBe('TypeScript');
  });

  it('drops nulls and empty strings', () => {
    expect(pickPrimaryLanguage(['Go', null, '', 'Go', 'Rust'] as Array<string | null>)).toBe('Go');
  });

  it('returns null when no languages are present', () => {
    expect(pickPrimaryLanguage([])).toBeNull();
    expect(pickPrimaryLanguage([null, null, ''] as Array<string | null>)).toBeNull();
  });

  it('returns the only language when there is one', () => {
    expect(pickPrimaryLanguage(['Rust'])).toBe('Rust');
  });

  it('case-sensitive — GitHub returns canonical names', () => {
    // GitHub returns canonical capitalization ("TypeScript" not "typescript").
    // We trust that and don't normalise.
    expect(pickPrimaryLanguage(['typescript', 'TypeScript', 'TypeScript'])).toBe('TypeScript');
  });

  it('ties break by first-seen', () => {
    expect(pickPrimaryLanguage(['Go', 'Rust', 'Go', 'Rust'])).toBe('Go');
  });
});
