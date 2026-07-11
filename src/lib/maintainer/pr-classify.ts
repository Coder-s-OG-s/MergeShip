import { z } from 'zod';
import { llmCall } from '@/lib/llm/router';

/**
 * Heuristic-based AI/spam PR classifier fallback.
 */
function classifyPrHeuristic(pr: { title: string; body: string | null }): boolean {
  const body = pr.body ?? '';
  const title = pr.title ?? '';

  // Very short title + empty/tiny body → likely noise
  if (title.length < 20 && body.length < 30) return true;

  const AI_KEYWORDS_RE =
    /\b(generated[\s-]by|created[\s-]with|via[\s-]ai|copilot|chatgpt|openai|gpt-[34])\b/i;

  // Body mentions well-known AI tool keywords
  if (AI_KEYWORDS_RE.test(body) || AI_KEYWORDS_RE.test(title)) return true;

  return false;
}

const prClassificationSchema = z.object({
  isAiGenerated: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

/**
 * LLM-powered structured PR classification.
 * Falls back to deterministic heuristic if providers fail.
 */
export async function classifyPrAsAi(pr: { title: string; body: string | null }): Promise<boolean> {
  const prompt = `Analyze the following Pull Request to determine if it is AI-generated, spam, or noise.
Return a structured classification.

PR Title: ${pr.title}
PR Body: ${pr.body ?? '(empty)'}`;

  const result = await llmCall({
    prompt,
    schema: prClassificationSchema,
  });

  if (result.ok) {
    return result.data.isAiGenerated;
  }

  // Fallback to heuristic if LLM provider chain fails or validation fails
  return classifyPrHeuristic(pr);
}
