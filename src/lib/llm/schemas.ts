import { z } from 'zod';

export const DifficultySchema = z.object({
  difficulty: z.enum(['E', 'M', 'H']),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(280),
});
export type DifficultyOutput = z.infer<typeof DifficultySchema>;

export const SummarySchema = z.object({
  summary: z.string().min(1).max(200),
});
export type SummaryOutput = z.infer<typeof SummarySchema>;

export const LearningPathSchema = z.object({
  paths: z
    .array(
      z.object({
        title: z.string().max(80),
        description: z.string().max(280),
        focus: z.string().max(40),
      }),
    )
    .length(2),
});
export type LearningPathOutput = z.infer<typeof LearningPathSchema>;
