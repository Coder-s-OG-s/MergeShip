import { getGroqClient, isGroqConfigured } from '../groq-client';
import type { LlmProvider } from './router';

export const groqProvider: LlmProvider = {
  name: 'groq',
  complete: async (prompt: string) => {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
    });
    return completion.choices[0]?.message?.content ?? '';
  },
  isHealthy: () => isGroqConfigured(),
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
