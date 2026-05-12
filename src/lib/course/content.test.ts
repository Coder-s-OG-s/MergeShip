import { describe, it, expect } from 'vitest';
import { moduleBySlug, COURSE_MODULES, TOTAL_MODULES, PASS_THRESHOLD } from './content';

describe('course content', () => {
  it('exposes exactly 5 modules', () => {
    expect(TOTAL_MODULES).toBe(5);
    expect(COURSE_MODULES).toHaveLength(5);
  });

  it('pass threshold is 80', () => {
    expect(PASS_THRESHOLD).toBe(80);
  });

  it('moduleBySlug finds existing module', () => {
    const first = COURSE_MODULES[0];
    expect(first).toBeDefined();
    expect(moduleBySlug(first!.slug)).toBe(first);
  });

  it('moduleBySlug returns undefined for unknown slug', () => {
    expect(moduleBySlug('not-a-real-slug')).toBeUndefined();
  });

  it('each module has a quiz with at least one question', () => {
    for (const m of COURSE_MODULES) {
      expect(m.quiz.length).toBeGreaterThan(0);
    }
  });
});
