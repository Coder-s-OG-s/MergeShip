import { GoogleGenAI } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('⚠️  GEMINI_API_KEY is not set. Gemini fallback will be unavailable.');
}

let geminiClient: GoogleGenAI | null = null;

if (geminiApiKey) {
  geminiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
  });
}

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    throw new Error('GEMINI_API_KEY is not configured. Cannot initialize Gemini client.');
  }
  return geminiClient;
}

export function isGeminiConfigured(): boolean {
  return !!geminiClient;
}
