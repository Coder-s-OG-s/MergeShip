import Groq from 'groq-sdk';

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn('⚠️  GROQ_API_KEY is not set. AI triage features will be unavailable.');
}

let groqClient: Groq | null = null;

if (groqApiKey) {
  groqClient = new Groq({
    apiKey: groqApiKey,
  });
}

export function getGroqClient(): Groq {
  if (!groqClient) {
    throw new Error('GROQ_API_KEY is not configured. Cannot initialize Groq client.');
  }
  return groqClient;
}

export function isGroqConfigured(): boolean {
  return !!groqClient;
}
