import { describe, it, expect } from 'vitest';
import { gradeQuiz, computeScore } from './grade';
import { COURSE_MODULES, PASS_THRESHOLD } from './content';

const firstModule = COURSE_MODULES[0]!;

describe('computeScore', () => {
  it('100% on all correct', () => {
    const answers = Object.fromEntries(firstModule.quiz.map((q) => [q.id, q.correctIndex]));
    expect(computeScore(firstModule, answers)).toBe(100);
  });

  it('0% on all wrong', () => {
    const answers = Object.fromEntries(
      firstModule.quiz.map((q) => [q.id, (q.correctIndex + 1) % q.options.length]),
    );
    expect(computeScore(firstModule, answers)).toBe(0);
  });

  it('partial score', () => {
    const answers: Record<string, number> = {};
    const q0 = firstModule.quiz[0]!;
    answers[q0.id] = q0.correctIndex;
    const q1 = firstModule.quiz[1]!;
    answers[q1.id] = (q1.correctIndex + 1) % q1.options.length;
    expect(computeScore(firstModule, answers)).toBe(50);
  });

  it('missing answers count as wrong', () => {
    expect(computeScore(firstModule, {})).toBe(0);
  });
});

describe('gradeQuiz', () => {
  it('returns passed=true when at or above threshold', () => {
    const answers = Object.fromEntries(firstModule.quiz.map((q) => [q.id, q.correctIndex]));
    const result = gradeQuiz(firstModule, answers);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it('returns passed=false when below threshold', () => {
    const result = gradeQuiz(firstModule, {});
    expect(result.passed).toBe(false);
  });

  it('flags incorrect questions in details', () => {
    const result = gradeQuiz(firstModule, {});
    expect(result.incorrectIds.length).toBeGreaterThan(0);
  });
});
