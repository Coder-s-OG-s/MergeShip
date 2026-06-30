/**
 * Heuristic-based AI/spam PR classifier (v1).
 *
 * Intentionally simple: pure function with no network calls so it can be
 * tested in isolation and swapped for an LLM-based classifier later.
 *
 * Returns true when the PR looks like AI-generated or spam content.
 */

const AI_KEYWORDS_RE =
  /\b(generated[\s-]by|created[\s-]with|via[\s-]ai|copilot|chatgpt|openai|gpt-[34])\b/i;

export function classifyPrAsAi(pr: { title: string; body: string | null }): boolean {
  const body = pr.body ?? '';
  const title = pr.title ?? '';

  // Very short title + empty/tiny body → likely noise
  if (title.length < 20 && body.length < 30) return true;

  // Body mentions well-known AI tool keywords
  if (AI_KEYWORDS_RE.test(body) || AI_KEYWORDS_RE.test(title)) return true;

  return false;
}
