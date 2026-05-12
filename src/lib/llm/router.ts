import { z } from 'zod';
import type { Result } from '../result';
import { ok, err } from '../result';

/**
 * LLM router. v1 = Groq only. Phase 2 adds Cerebras / Together / Gemini fallback chain
 * by extending PROVIDERS. Every call:
 *   1. Pick healthy provider
 *   2. Call .complete(prompt)
 *   3. Parse output (handles JSON in prose)
 *   4. Validate against zod schema
 *   5. Return Result<T> — caller decides degraded behaviour
 *
 * Critical: caller MUST handle err() gracefully. LLM is enrichment, not gate.
 */

export type LlmProvider = {
  name: string;
  complete: (prompt: string) => Promise<string>;
  isHealthy: () => boolean;
};

type LlmCallArgs<T> = {
  prompt: string;
  schema: z.ZodType<T>;
};

let providerOverride: LlmProvider | null = null;

export function __setLlmProvider(p: LlmProvider | null): void {
  providerOverride = p;
}

function pickProvider(): LlmProvider | null {
  return providerOverride;
}

function extractJson(raw: string): string {
  // LLMs often wrap JSON in prose or ```json fences. Pull the first {...} or [...] block.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  const arr = raw.match(/\[[\s\S]*\]/);
  if (arr) return arr[0];
  return raw;
}

export async function llmCall<T>(args: LlmCallArgs<T>): Promise<Result<T>> {
  const provider = pickProvider();
  if (!provider) return err('llm_unavailable', 'no LLM provider configured', false);
  if (!provider.isHealthy()) return err('llm_unavailable', `${provider.name} unhealthy`, true);

  let raw: string;
  try {
    raw = await provider.complete(args.prompt);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    return err('llm_provider_error', `${provider.name}: ${message}`, true);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return err('llm_schema_invalid', `${provider.name} returned non-JSON`, false);
  }

  const result = args.schema.safeParse(parsed);
  if (!result.success) {
    return err('llm_schema_invalid', result.error.issues.map((i) => i.message).join('; '), false);
  }
  return ok(result.data);
}
