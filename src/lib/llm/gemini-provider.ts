import { getGeminiClient, isGeminiConfigured } from '../gemini-client';
import type { LlmProvider } from './router';

export const geminiProvider: LlmProvider = {
  name: 'gemini',
  complete: async (prompt: string) => {
    const ai = getGeminiClient();
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text ?? '';
  },
  isHealthy: () => isGeminiConfigured(),
  isTransientError: (e: unknown) => {
    if (typeof e === 'object' && e !== null && 'status' in e) {
      const status = (e as any).status;
      // 429 Rate Limit, or 5xx Server Error
      if (status === 429 || (status >= 500 && status < 600)) {
        return true;
      }
    }
    if (e instanceof Error) {
      const msg = e.message.toLowerCase();
      if (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('econnrefused')
      ) {
        return true;
      }
    }
    return false;
  },
};
