'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeCourseModule } from '@/app/actions/course';
import type { QuizQuestion } from '@/lib/course/content';

type Props = {
  slug: string;
  quiz: QuizQuestion[];
  previousScore: number | null;
};

export default function ModuleQuiz({ slug, quiz, previousScore }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<null | {
    passed: boolean;
    score: number;
    courseFinished: boolean;
    xpAwarded: number;
  }>(null);

  function onSelect(qid: string, idx: number) {
    setAnswers((a) => ({ ...a, [qid]: idx }));
    setFeedback(null);
  }

  function onSubmit() {
    startTransition(async () => {
      const res = await completeCourseModule(slug, answers);
      if (!res.ok) {
        setFeedback({ passed: false, score: 0, courseFinished: false, xpAwarded: 0 });
        return;
      }
      setFeedback({
        passed: res.data.passed,
        score: res.data.score,
        courseFinished: res.data.courseFinished,
        xpAwarded: res.data.xpAwarded,
      });
      if (res.data.passed) {
        // Server state changed (course_progress). Refresh so the list page picks it up.
        router.refresh();
      }
    });
  }

  const allAnswered = quiz.every((q) => answers[q.id] !== undefined);

  return (
    <section className="mt-8">
      <h2 className="mb-4 font-display text-xl font-semibold">Quick check</h2>
      {previousScore !== null && (
        <p className="mb-4 text-sm text-emerald-400">
          You previously scored {previousScore}% on this module.
        </p>
      )}

      <ol className="space-y-6">
        {quiz.map((q, qi) => (
          <li key={q.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 px-3 py-2 transition hover:border-zinc-700 ${
                    answers[q.id] === oi ? 'border-purple-500 bg-purple-950/30' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => onSelect(q.id, oi)}
                    className="mt-1"
                  />
                  <span className="text-sm text-zinc-200">{opt}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={onSubmit}
          disabled={!allAnswered || pending}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {pending ? 'Submitting…' : 'Submit answers'}
        </button>

        {feedback && (
          <p className={`text-sm ${feedback.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
            {feedback.passed
              ? feedback.courseFinished
                ? `Passed (${feedback.score}%). Course complete! +${feedback.xpAwarded} XP.`
                : `Passed (${feedback.score}%). +${feedback.xpAwarded} XP.`
              : `Score ${feedback.score}%. Review the module and try again.`}
          </p>
        )}
      </div>
    </section>
  );
}
