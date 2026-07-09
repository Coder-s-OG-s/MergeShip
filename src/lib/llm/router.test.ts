import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { z } from 'zod';
import { llmCall, __setLlmProviders, type LlmProvider } from './router';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-12T00:00:00Z'));
});
afterEach(() => {
  __setLlmProviders(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const schema = z.object({ ok: z.boolean(), answer: z.string() });

const createMockProvider = (
  name: string,
  completeMock: Mock,
  isHealthy = true,
  isTransient = false,
): LlmProvider => ({
  name,
  complete: completeMock,
  isHealthy: () => isHealthy,
  isTransientError: () => isTransient,
});

describe('llmCall', () => {
  it('returns parsed result on valid output from first provider', async () => {
    const mockProvider = createMockProvider(
      'mock1',
      vi.fn().mockResolvedValue(JSON.stringify({ ok: true, answer: 'hi' })),
    );
    __setLlmProviders([mockProvider]);

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('hi');
  });

  it('falls back to second provider when first throws permanent error', async () => {
    const mock1 = createMockProvider(
      'mock1',
      vi.fn().mockRejectedValue(new Error('boom')),
      true,
      false,
    );
    const mock2 = createMockProvider(
      'mock2',
      vi.fn().mockResolvedValue(JSON.stringify({ ok: true, answer: 'fallback' })),
    );
    __setLlmProviders([mock1, mock2]);

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('fallback');
    expect(mock1.complete).toHaveBeenCalledTimes(1);
    expect(mock2.complete).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors before falling back', async () => {
    // First 2 times it fails with transient error, 3rd time (max retries exceeded) falls back
    const complete1 = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'));

    const mock1 = createMockProvider('mock1', complete1, true, true);
    const mock2 = createMockProvider(
      'mock2',
      vi.fn().mockResolvedValue(JSON.stringify({ ok: true, answer: 'fallback' })),
    );
    __setLlmProviders([mock1, mock2]);

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('fallback');
    expect(mock1.complete).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(mock2.complete).toHaveBeenCalledTimes(1);
  });

  it('succeeds after a transient retry', async () => {
    const complete1 = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(JSON.stringify({ ok: true, answer: 'recovered' }));

    const mock1 = createMockProvider('mock1', complete1, true, true);
    __setLlmProviders([mock1]);

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('recovered');
    expect(mock1.complete).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable when all providers fail', async () => {
    const mock1 = createMockProvider(
      'mock1',
      vi.fn().mockRejectedValue(new Error('boom1')),
      true,
      false,
    );
    const mock2 = createMockProvider(
      'mock2',
      vi.fn().mockRejectedValue(new Error('boom2')),
      true,
      false,
    );
    __setLlmProviders([mock1, mock2]);

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('llm_unavailable');
      expect(r.error.message).toContain('All providers failed');
      expect(r.error.message).toContain('boom1');
      expect(r.error.message).toContain('boom2');
    }
    expect(mock1.complete).toHaveBeenCalledTimes(1);
    expect(mock2.complete).toHaveBeenCalledTimes(1);
  });

  it('skips unhealthy provider and returns unavailable', async () => {
    const mock = createMockProvider('mock', vi.fn(), false);
    __setLlmProviders([mock]);
    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('llm_unavailable');
    expect(mock.complete).not.toHaveBeenCalled();
  });

  it('retries schema validation once, then falls back', async () => {
    const complete1 = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ wrong: 'schema' })) // fails schema
      .mockResolvedValueOnce(JSON.stringify({ wrong: 'schema again' })); // fails schema again
    const mock1 = createMockProvider('mock1', complete1);

    const complete2 = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ ok: true, answer: 'schema fixed in fallback' }));
    const mock2 = createMockProvider('mock2', complete2);

    __setLlmProviders([mock1, mock2]);

    const r = await llmCall({ prompt: 'noop', schema });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('schema fixed in fallback');

    // Schema retry is done exactly once per provider. So total 2 calls to mock1.
    expect(mock1.complete).toHaveBeenCalledTimes(2);
    expect(mock2.complete).toHaveBeenCalledTimes(1);
  });

  it('handles timeout fallback', async () => {
    const complete1 = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 15000)));
    const mock1 = createMockProvider('mock1', complete1, true, false); // Not returning transient=true since Timeout is inherently retried

    const mock2 = createMockProvider(
      'mock2',
      vi.fn().mockResolvedValue(JSON.stringify({ ok: true, answer: 'fallback after timeout' })),
    );
    __setLlmProviders([mock1, mock2]);

    const callPromise = llmCall({ prompt: 'noop', schema });

    // Fast-forward 30 seconds to trigger all retries
    await vi.advanceTimersByTimeAsync(35000);

    const r = await callPromise;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.answer).toBe('fallback after timeout');

    // Timeout is treated as transient (so it retries 2 times = total 3 calls)
    expect(mock1.complete).toHaveBeenCalledTimes(3);
    expect(mock2.complete).toHaveBeenCalledTimes(1);
  });
});
