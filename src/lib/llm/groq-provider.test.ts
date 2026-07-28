import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groqProvider } from './groq-provider';
import { getGroqClient, isGroqConfigured } from '../groq-client';

vi.mock('../groq-client', () => ({
  getGroqClient: vi.fn(),
  isGroqConfigured: vi.fn(),
}));

describe('Groq Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('should be groq', () => {
      expect(groqProvider.name).toBe('groq');
    });
  });

  describe('isHealthy', () => {
    it('returns true when configured', () => {
      vi.mocked(isGroqConfigured).mockReturnValue(true);
      expect(groqProvider.isHealthy()).toBe(true);
    });

    it('returns false when not configured', () => {
      vi.mocked(isGroqConfigured).mockReturnValue(false);
      expect(groqProvider.isHealthy()).toBe(false);
    });
  });

  describe('complete', () => {
    it('returns generated text on success', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'groq response' } }],
      });
      vi.mocked(getGroqClient).mockReturnValue({
        chat: { completions: { create: createMock } },
      } as any);

      const result = await groqProvider.complete('test prompt');

      expect(result).toBe('groq response');
      expect(createMock).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'test prompt' }],
        model: 'llama3-8b-8192',
      });
    });

    it('returns empty string if content is undefined', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: undefined } }],
      });
      vi.mocked(getGroqClient).mockReturnValue({
        chat: { completions: { create: createMock } },
      } as any);

      const result = await groqProvider.complete('test prompt');

      expect(result).toBe('');
    });

    it('returns empty string if choices array is empty', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [],
      });
      vi.mocked(getGroqClient).mockReturnValue({
        chat: { completions: { create: createMock } },
      } as any);

      const result = await groqProvider.complete('test prompt');

      expect(result).toBe('');
    });

    it('throws error if API call fails', async () => {
      const createMock = vi.fn().mockRejectedValue(new Error('API Error'));
      vi.mocked(getGroqClient).mockReturnValue({
        chat: { completions: { create: createMock } },
      } as any);

      await expect(groqProvider.complete('test prompt')).rejects.toThrow('API Error');
    });
  });

  describe('isTransientError', () => {
    it('returns true for 429 status', () => {
      expect(groqProvider.isTransientError({ status: 429 })).toBe(true);
    });

    it('returns true for 5xx status', () => {
      expect(groqProvider.isTransientError({ status: 500 })).toBe(true);
      expect(groqProvider.isTransientError({ status: 503 })).toBe(true);
      expect(groqProvider.isTransientError({ status: 599 })).toBe(true);
    });

    it('returns false for 4xx status (except 429)', () => {
      expect(groqProvider.isTransientError({ status: 400 })).toBe(false);
      expect(groqProvider.isTransientError({ status: 401 })).toBe(false);
      expect(groqProvider.isTransientError({ status: 404 })).toBe(false);
    });

    it('returns true for network related error messages', () => {
      expect(groqProvider.isTransientError(new Error('fetch failed'))).toBe(true);
      expect(groqProvider.isTransientError(new Error('network error'))).toBe(true);
      expect(groqProvider.isTransientError(new Error('timeout exceeded'))).toBe(true);
      expect(groqProvider.isTransientError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('returns false for unknown errors', () => {
      expect(groqProvider.isTransientError(new Error('invalid prompt'))).toBe(false);
      expect(groqProvider.isTransientError('just a string')).toBe(false);
      expect(groqProvider.isTransientError(null)).toBe(false);
    });
  });
});
