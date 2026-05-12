import { describe, it, expect } from 'vitest';
import { DifficultySchema, SummarySchema, LearningPathSchema } from './schemas';

describe('DifficultySchema', () => {
  it('accepts valid E/M/H output', () => {
    const ok = DifficultySchema.parse({ difficulty: 'M', confidence: 0.8, reason: 'labels say' });
    expect(ok.difficulty).toBe('M');
  });

  it('rejects unknown difficulty', () => {
    expect(() =>
      DifficultySchema.parse({ difficulty: 'X', confidence: 0.5, reason: 'x' }),
    ).toThrow();
  });

  it('rejects confidence > 1', () => {
    expect(() =>
      DifficultySchema.parse({ difficulty: 'E', confidence: 1.5, reason: 'x' }),
    ).toThrow();
  });

  it('rejects confidence < 0', () => {
    expect(() =>
      DifficultySchema.parse({ difficulty: 'E', confidence: -0.1, reason: 'x' }),
    ).toThrow();
  });

  it('rejects reason over 280 chars', () => {
    expect(() =>
      DifficultySchema.parse({ difficulty: 'E', confidence: 0.5, reason: 'a'.repeat(281) }),
    ).toThrow();
  });
});

describe('SummarySchema', () => {
  it('accepts a short summary', () => {
    expect(SummarySchema.parse({ summary: 'fixes a bug' }).summary).toBe('fixes a bug');
  });

  it('rejects empty summary', () => {
    expect(() => SummarySchema.parse({ summary: '' })).toThrow();
  });

  it('rejects summary over 200 chars', () => {
    expect(() => SummarySchema.parse({ summary: 'a'.repeat(201) })).toThrow();
  });
});

describe('LearningPathSchema', () => {
  const validPath = { title: 'Frontend', description: 'react + ts', focus: 'ui' };

  it('accepts exactly two paths', () => {
    const ok = LearningPathSchema.parse({ paths: [validPath, validPath] });
    expect(ok.paths).toHaveLength(2);
  });

  it('rejects one path', () => {
    expect(() => LearningPathSchema.parse({ paths: [validPath] })).toThrow();
  });

  it('rejects three paths', () => {
    expect(() => LearningPathSchema.parse({ paths: [validPath, validPath, validPath] })).toThrow();
  });

  it('rejects path with overlong title', () => {
    expect(() =>
      LearningPathSchema.parse({
        paths: [{ ...validPath, title: 'a'.repeat(81) }, validPath],
      }),
    ).toThrow();
  });
});
