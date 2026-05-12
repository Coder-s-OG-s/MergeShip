import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { llmCall, __setLlmProvider } from './router';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-12T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const schema = z.object({ ok: z.boolean(), answer: z.string() });

describe('llmCall', () => {
  it('returns parsed result on valid output', async () => {
    __setLlmProvider({
      name: 'mock',
      complete: async () => JSON.stringify({ ok: true, answer: 'hi' }),
      isHealthy: () => true,
    });

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('hi');
  });

  it('returns null-data error when output fails schema', async () => {
    __setLlmProvider({
      name: 'mock',
      complete: async () => JSON.stringify({ ok: 'not-a-bool', answer: 'x' }),
      isHealthy: () => true,
    });
    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('llm_schema_invalid');
  });

  it('returns error when provider throws', async () => {
    __setLlmProvider({
      name: 'mock',
      complete: async () => {
        throw new Error('boom');
      },
      isHealthy: () => true,
    });
    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('llm_provider_error');
  });

  it('skips unhealthy provider and returns unavailable', async () => {
    __setLlmProvider({
      name: 'mock',
      complete: async () => 'never called',
      isHealthy: () => false,
    });
    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('llm_unavailable');
  });

  it('strips surrounding text when LLM wraps JSON in prose', async () => {
    __setLlmProvider({
      name: 'mock',
      complete: async () =>
        'Sure! Here is the JSON:\n```json\n{"ok":true,"answer":"yo"}\n```\nhope that helps',
      isHealthy: () => true,
    });
    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('yo');
  });
});
