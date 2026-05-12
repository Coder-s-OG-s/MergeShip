import { type CourseModule, PASS_THRESHOLD } from './content';

export function computeScore(module: CourseModule, answers: Record<string, number>): number {
  if (module.quiz.length === 0) return 100;
  let correct = 0;
  for (const q of module.quiz) {
    if (answers[q.id] === q.correctIndex) correct += 1;
  }
  return Math.round((correct / module.quiz.length) * 100);
}

export type GradeResult = {
  score: number;
  passed: boolean;
  incorrectIds: string[];
};

export function gradeQuiz(module: CourseModule, answers: Record<string, number>): GradeResult {
  const incorrectIds: string[] = [];
  for (const q of module.quiz) {
    if (answers[q.id] !== q.correctIndex) incorrectIds.push(q.id);
  }
  const score = computeScore(module, answers);
  return { score, passed: score >= PASS_THRESHOLD, incorrectIds };
}
