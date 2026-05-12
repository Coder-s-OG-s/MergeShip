import { describe, it, expect, vi } from 'vitest';
import { scoreDifficultyFromLabels, scoreDifficulty, repoHealth } from './score';

describe('scoreDifficultyFromLabels', () => {
  it('"good first issue" -> E with high confidence', () => {
    const r = scoreDifficultyFromLabels(['good first issue']);
    expect(r.difficulty).toBe('E');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('hyphenated "good-first-issue" matches too', () => {
    const r = scoreDifficultyFromLabels(['good-first-issue']);
    expect(r.difficulty).toBe('E');
  });

  it('"beginner" -> E', () => {
    expect(scoreDifficultyFromLabels(['beginner']).difficulty).toBe('E');
  });

  it('"help wanted" -> M', () => {
    const r = scoreDifficultyFromLabels(['help wanted']);
    expect(r.difficulty).toBe('M');
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('"complex" -> H', () => {
    expect(scoreDifficultyFromLabels(['complex']).difficulty).toBe('H');
  });

  it('"epic" -> H', () => {
    expect(scoreDifficultyFromLabels(['epic']).difficulty).toBe('H');
  });

  it('no recognized labels -> low confidence', () => {
    const r = scoreDifficultyFromLabels(['needs-triage', 'documentation']);
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('case-insensitive', () => {
    expect(scoreDifficultyFromLabels(['Good First Issue']).difficulty).toBe('E');
    expect(scoreDifficultyFromLabels(['HELP WANTED']).difficulty).toBe('M');
  });

  it('empty labels -> low confidence default M', () => {
    const r = scoreDifficultyFromLabels([]);
    expect(r.confidence).toBeLessThan(0.5);
  });
});

describe('scoreDifficulty (full pipeline)', () => {
  it('uses high-confidence label result without calling LLM', async () => {
    const llmSpy = vi.fn();
    const result = await scoreDifficulty(
      { title: 'fix typo in README', body: 'small', labels: ['good first issue'] },
      { llmFallback: llmSpy },
    );
    expect(result.difficulty).toBe('E');
    expect(result.source).toBe('label');
    expect(llmSpy).not.toHaveBeenCalled();
  });

  it('falls back to LLM when label confidence is low', async () => {
    const llmSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { difficulty: 'H', confidence: 0.9, reason: 'rewrites parser' },
    });
    const result = await scoreDifficulty(
      { title: 'refactor parser', body: 'major change', labels: [] },
      { llmFallback: llmSpy },
    );
    expect(result.difficulty).toBe('H');
    expect(result.source).toBe('llm');
    expect(llmSpy).toHaveBeenCalledOnce();
  });

  it('falls back to heuristic when LLM unavailable', async () => {
    const llmSpy = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'llm_unavailable', message: '', retryable: true },
    });
    const result = await scoreDifficulty(
      { title: 'something', body: 'short body', labels: [] },
      { llmFallback: llmSpy },
    );
    expect(result.source).toBe('heuristic');
    expect(['E', 'M', 'H']).toContain(result.difficulty);
  });

  it('long body with multiple comments hints at H heuristically', async () => {
    const result = await scoreDifficulty(
      {
        title: 'large refactor',
        body: 'A'.repeat(3000),
        labels: [],
        commentCount: 50,
      },
      { llmFallback: undefined },
    );
    expect(result.difficulty).toBe('H');
  });

  it('tiny body, no comments hints at E', async () => {
    const result = await scoreDifficulty(
      { title: 'tiny', body: 'one line', labels: [], commentCount: 0 },
      { llmFallback: undefined },
    );
    expect(result.difficulty).toBe('E');
  });
});

describe('repoHealth', () => {
  it('healthy repo scores high', () => {
    const score = repoHealth({
      stars: 5000,
      recentCommits30d: 50,
      hasContributingMd: true,
      hasLicense: true,
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('abandoned repo scores low', () => {
    const score = repoHealth({
      stars: 5,
      recentCommits30d: 0,
      hasContributingMd: false,
      hasLicense: false,
    });
    expect(score).toBeLessThan(40);
  });

  it('caps at 100', () => {
    const score = repoHealth({
      stars: 1_000_000,
      recentCommits30d: 1000,
      hasContributingMd: true,
      hasLicense: true,
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});
