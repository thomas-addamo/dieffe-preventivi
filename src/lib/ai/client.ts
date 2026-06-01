import Groq from 'groq-sdk';
import { env } from '../env';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export function isAiConfigured() {
  return !!env.GROQ_API_KEY;
}

export async function generateAI(prompt: string, timeoutMs = 8000): Promise<string> {
  const response = await Promise.race([
    groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    ),
  ]);

  return response.choices[0]?.message?.content ?? '';
}
