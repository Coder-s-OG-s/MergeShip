'use client';

import { useState } from 'react';

interface PlacementLevel {
  score: number;
  level: 0 | 1 | 2;
}

const QUIZ_QUESTIONS = [
  {
    id: 0,
    question: 'What is the primary purpose of code review?',
    options: [
      'To identify bugs and improve code quality',
      'To slow down development',
      'To assert authority over the code',
      'To document code changes',
    ],
  },
  {
    id: 1,
    question: 'When contributing to open source, what should you do first?',
    options: [
      'Ask the maintainer for permission',
      'Read the CONTRIBUTING guidelines and existing issues',
      'Start coding immediately',
      'Fork the repo and make random changes',
    ],
  },
  {
    id: 2,
    question: 'What is a good practice for commit messages?',
    options: [
      'Use single words like "fix" or "update"',
      'Write descriptive messages explaining the why',
      "Don't bother with messages",
      'Copy commit messages from other projects',
    ],
  },
  {
    id: 3,
    question: 'How should you handle merge conflicts?',
    options: [
      'Delete all conflicting lines',
      'Accept all incoming changes',
      'Carefully review and resolve conflicts manually',
      'Ask someone else to resolve them',
    ],
  },
  {
    id: 4,
    question: 'What is the benefit of writing tests?',
    options: [
      'Tests slow down development',
      'Tests catch regressions and ensure code quality',
      'Tests are only for senior developers',
      'Tests are not necessary for open source',
    ],
  },
  {
    id: 5,
    question: 'How should you respond to critical feedback on your PR?',
    options: [
      'Get defensive and argue',
      'Ignore the feedback',
      'Listen, learn, and improve the code accordingly',
      'Blame the reviewer',
    ],
  },
  {
    id: 6,
    question: 'What does "atomic commit" mean?',
    options: [
      'A very small commit',
      'A commit that does one logical unit of work',
      'A commit that is impossible to understand',
      'A commit with many unrelated changes',
    ],
  },
];

interface PlacementQuizProps {
  onComplete?: (result: PlacementLevel) => void;
}

export function PlacementQuiz({ onComplete }: PlacementQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlacementLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleSubmit = async () => {
    if (answers.length !== QUIZ_QUESTIONS.length) {
      setError('Please answer all questions before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const data = await response.json();
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const levelDescriptions = {
      0: 'Level 0 - Getting Started: Focus on foundational knowledge',
      1: 'Level 1 - Contributor: Ready for guided contributions',
      2: 'Level 2 - Experienced: Ready for complex contributions',
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-green-500 bg-green-50 p-6">
          <h2 className="text-2xl font-bold text-green-900">Quiz Complete!</h2>
          <p className="mt-2 text-green-800">Score: {Math.round(result.score * 100)}%</p>
          <p className="mt-4 text-lg font-semibold text-green-900">
            {levelDescriptions[result.level]}
          </p>
        </div>
      </div>
    );
  }

  if (answers.length === QUIZ_QUESTIONS.length) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-bold">Ready to Submit?</h2>
          <p className="mt-2 text-gray-600">
            You have answered all {QUIZ_QUESTIONS.length} questions.
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-red-500 bg-red-50 p-4">
            <p className="text-red-900">{error}</p>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>
    );
  }

  const question = QUIZ_QUESTIONS[currentQuestion]!;
  const answered = currentQuestion in answers;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Placement Quiz</h2>
        <span className="text-gray-600">
          Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100}%`,
          }}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-6 text-lg font-semibold">{question.question}</h3>

        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                answers[currentQuestion] === index
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-50 p-4">
          <p className="text-red-900">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-100 disabled:opacity-50"
        >
          Previous
        </button>
        {currentQuestion < QUIZ_QUESTIONS.length - 1 && (
          <button
            onClick={() =>
              setCurrentQuestion(Math.min(QUIZ_QUESTIONS.length - 1, currentQuestion + 1))
            }
            disabled={!answered}
            className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
