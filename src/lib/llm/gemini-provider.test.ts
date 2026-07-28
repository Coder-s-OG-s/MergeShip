import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geminiProvider } from './gemini-provider';
import { getGeminiClient, isGeminiConfigured } from '../gemini-client';

vi.mock('../gemini-client', () => ({
  getGeminiClient: vi.fn(),
  isGeminiConfigured: vi.fn(),
}));

describe('Gemini Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('should be gemini', () => {
      expect(geminiProvider.name).toBe('gemini');
    });
  });

  describe('isHealthy', () => {
    it('returns true when configured', () => {
      vi.mocked(isGeminiConfigured).mockReturnValue(true);
      expect(geminiProvider.isHealthy()).toBe(true);
    });

    it('returns false when not configured', () => {
      vi.mocked(isGeminiConfigured).mockReturnValue(false);
      expect(geminiProvider.isHealthy()).toBe(false);
    });
  });

  describe('complete', () => {
    it('returns generated text on success', async () => {
      const generateContentMock = vi.fn().mockResolvedValue({ text: 'gemini response' });
      vi.mocked(getGeminiClient).mockReturnValue({
        models: { generateContent: generateContentMock },
      } as any);

      const result = await geminiProvider.complete('test prompt');

      expect(result).toBe('gemini response');
      expect(generateContentMock).toHaveBeenCalledWith({
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        contents: 'test prompt',
      });
    });

    it('returns empty string if text is undefined', async () => {
      const generateContentMock = vi.fn().mockResolvedValue({ text: undefined });
      vi.mocked(getGeminiClient).mockReturnValue({
        models: { generateContent: generateContentMock },
      } as any);

      const result = await geminiProvider.complete('test prompt');

      expect(result).toBe('');
    });

    it('throws error if API call fails', async () => {
      const generateContentMock = vi.fn().mockRejectedValue(new Error('API Error'));
      vi.mocked(getGeminiClient).mockReturnValue({
        models: { generateContent: generateContentMock },
      } as any);

      await expect(geminiProvider.complete('test prompt')).rejects.toThrow('API Error');
    });
  });

  describe('isTransientError', () => {
    it('returns true for 429 status', () => {
      expect(geminiProvider.isTransientError({ status: 429 })).toBe(true);
    });

    it('returns true for 5xx status', () => {
      expect(geminiProvider.isTransientError({ status: 500 })).toBe(true);
      expect(geminiProvider.isTransientError({ status: 503 })).toBe(true);
      expect(geminiProvider.isTransientError({ status: 599 })).toBe(true);
    });

    it('returns false for 4xx status (except 429)', () => {
      expect(geminiProvider.isTransientError({ status: 400 })).toBe(false);
      expect(geminiProvider.isTransientError({ status: 401 })).toBe(false);
      expect(geminiProvider.isTransientError({ status: 404 })).toBe(false);
    });

    it('returns true for network related error messages', () => {
      expect(geminiProvider.isTransientError(new Error('fetch failed'))).toBe(true);
      expect(geminiProvider.isTransientError(new Error('network error'))).toBe(true);
      expect(geminiProvider.isTransientError(new Error('timeout exceeded'))).toBe(true);
      expect(geminiProvider.isTransientError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('returns false for unknown errors', () => {
      expect(geminiProvider.isTransientError(new Error('invalid prompt'))).toBe(false);
      expect(geminiProvider.isTransientError('just a string')).toBe(false);
      expect(geminiProvider.isTransientError(null)).toBe(false);
    });
  });
});
