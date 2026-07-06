import { z } from 'zod';
import type { Result } from '../result';
import { ok, err } from '../result';
import { groqProvider } from './groq-provider';
import { geminiProvider } from './gemini-provider';

export type LlmProvider = {
  name: string;
  complete: (prompt: string) => Promise<string>;
  isHealthy: () => boolean;
  isTransientError: (e: unknown) => boolean;
};

type LlmCallArgs<T> = {
  prompt: string;
  schema: z.ZodType<T>;
};

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

const defaultProviders: LlmProvider[] = [groqProvider, geminiProvider];
let providerOverrides: LlmProvider[] | null = null;

export function __setLlmProviders(p: LlmProvider[] | null): void {
  providerOverrides = p;
}

function getProviders(): LlmProvider[] {
  return providerOverrides ?? defaultProviders;
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

const runWithTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerName: string,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${providerName} took longer than ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export async function llmCall<T>(args: LlmCallArgs<T>): Promise<Result<T>> {
  const providers = getProviders();
  if (!providers.length) return err('llm_unavailable', 'no LLM providers configured', false);

  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.isHealthy()) {
      errors.push(`${provider.name} unhealthy`);
      continue;
    }

    let retryCount = 0;
    let schemaRetryCount = 0;

    while (retryCount <= MAX_RETRIES && schemaRetryCount <= 1) {
      let raw: string;
      try {
        raw = await runWithTimeout(provider.complete(args.prompt), TIMEOUT_MS, provider.name);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown';

        if (provider.isTransientError(e) || message.includes('Timeout')) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            continue; // Retry transient error on same provider
          }
        }

        // Permanent error or max retries reached, record error and fallback to next provider
        errors.push(`${provider.name}: ${message}`);
        break; // break while loop to move to the next provider in the outer loop
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(raw));
      } catch {
        // Schema invalid due to JSON parsing
        schemaRetryCount++;
        if (schemaRetryCount <= 1) {
          continue; // Retry schema once on same provider
        }
        errors.push(`${provider.name} returned non-JSON`);
        break; // Next provider
      }

      const result = args.schema.safeParse(parsed);
      if (!result.success) {
        schemaRetryCount++;
        if (schemaRetryCount <= 1) {
          continue; // Retry schema once on same provider
        }
        errors.push(
          `${provider.name} schema error: ${result.error.issues.map((i) => i.message).join('; ')}`,
        );
        break; // Next provider
      }

      // Success
      return ok(result.data);
    }
  }

  return err('llm_unavailable', `All providers failed: ${errors.join(' | ')}`, true);
}
