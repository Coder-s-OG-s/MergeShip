import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ANSWER_KEY = [0, 2, 1, 3, 2, 0, 1];

const PLACEMENT_THRESHOLDS = {
  LEVEL_2: 0.8,
  LEVEL_1: 0.6,
  LEVEL_0: 0.0,
} as const;

const quizSubmissionSchema = z.object({
  answers: z.array(z.number().int().min(0)).min(ANSWER_KEY.length).max(ANSWER_KEY.length),
});

type QuizSubmissionRequest = z.infer<typeof quizSubmissionSchema>;

interface QuizSubmissionResponse {
  success: boolean;
  score: number;
  level: 0 | 1 | 2;
  message?: string;
}

function computeScore(answers: number[]): number {
  if (answers.length !== ANSWER_KEY.length) {
    throw new Error('Invalid number of answers');
  }

  const correctCount = answers.filter((answer, index) => answer === ANSWER_KEY[index]).length;
  return correctCount / ANSWER_KEY.length;
}

function determinePlacementLevel(score: number): 0 | 1 | 2 {
  if (score >= PLACEMENT_THRESHOLDS.LEVEL_2) {
    return 2;
  } else if (score >= PLACEMENT_THRESHOLDS.LEVEL_1) {
    return 1;
  }
  return 0;
}

export async function POST(request: NextRequest): Promise<NextResponse<QuizSubmissionResponse>> {
  try {
    const body = await request.json();

    const validationResult = quizSubmissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          score: 0,
          level: 0,
          message: 'Invalid quiz submission: missing or invalid answers array',
        },
        { status: 400 }
      );
    }

    const { answers } = validationResult.data;

    const score = computeScore(answers);
    const level = determinePlacementLevel(score);

    return NextResponse.json(
      {
        success: true,
        score: Math.round(score * 100) / 100,
        level,
        message: `Quiz completed. Your placement level: ${level}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[quiz/submit] Error processing quiz submission:', error);
    return NextResponse.json(
      {
        success: false,
        score: 0,
        level: 0,
        message: 'Failed to process quiz submission',
      },
      { status: 500 }
    );
  }
}
